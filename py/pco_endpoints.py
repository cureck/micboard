"""
API endpoints for the simplified PCO scheduler
"""

import json
import logging
from typing import Dict
from tornado.web import RequestHandler
from datetime import datetime
import pco_scheduler
import config

# In-memory slot overrides store: { plan_id: { slot_number: name } }
# NOTE: This is ephemeral and will be cleared on server restart.
_slot_overrides: Dict[str, Dict[int, str]] = {}

def _normalize_overrides(overrides: Dict) -> Dict[int, str]:
    out: Dict[int, str] = {}
    if not isinstance(overrides, dict):
        return out
    for k, v in overrides.items():
        try:
            slot_num = int(k)
        except Exception:
            try:
                slot_num = int(str(k))
            except Exception:
                continue
        if isinstance(v, str):
            v_clean = v.strip()
        else:
            v_clean = '' if v is None else str(v)
        if v_clean:
            out[slot_num] = v_clean
    return out

def set_slot_overrides(plan_id: str, overrides: Dict[int, str]) -> None:
    existing = dict(_slot_overrides.get(plan_id, {}))
    for k, v in overrides.items():
        if v is None or (isinstance(v, str) and v.strip() == ''):
            if k in existing:
                existing.pop(k)
        else:
            existing[k] = v
    if existing:
        _slot_overrides[plan_id] = existing
    else:
        _slot_overrides.pop(plan_id, None)

def get_slot_overrides(plan_id: str) -> Dict[int, str]:
    return dict(_slot_overrides.get(plan_id, {}))

def clear_slot_overrides(plan_id: str, slots: list = None) -> None:
    if plan_id not in _slot_overrides:
        return
    if not slots:
        _slot_overrides.pop(plan_id, None)
        return
    for s in slots:
        try:
            s_int = int(s)
            _slot_overrides[plan_id].pop(s_int, None)
        except Exception:
            continue
    if not _slot_overrides[plan_id]:
        _slot_overrides.pop(plan_id, None)

class PCOUpcomingPlansHandler(RequestHandler):
    """Get list of all upcoming plans"""
    
    def get(self):
        scheduler = pco_scheduler.get_scheduler()
        if not scheduler:
            self.set_status(503)
            self.write({"error": "PCO scheduler not initialized"})
            return
        
        plans = scheduler.get_upcoming_plans()
        current_plan = scheduler.get_current_plan()
        
        # Mark which plan is currently active
        for plan in plans:
            plan['is_live'] = (current_plan and plan['plan_id'] == current_plan['plan_id'])
            plan['is_manual'] = (scheduler.manual_override_plan and 
                                plan['plan_id'] == scheduler.manual_override_plan['plan_id'])
            # Merge manual slot overrides if present
            try:
                ov = get_slot_overrides(plan['plan_id'])
                if ov:
                    sa = plan.get('slot_assignments') or {}
                    sa.update(ov)
                    plan['slot_assignments'] = sa
            except Exception:
                pass
        
        self.write({
            "status": "success",
            "plans": plans,
            "current_plan_id": current_plan['plan_id'] if current_plan else None
        })


class PCOSetManualPlanHandler(RequestHandler):
    """Set a manual plan override"""
    
    def post(self):
        scheduler = pco_scheduler.get_scheduler()
        if not scheduler:
            self.set_status(503)
            self.write({"error": "PCO scheduler not initialized"})
            return
        
        data = json.loads(self.request.body)
        plan_id = data.get('plan_id')
        
        if not plan_id:
            self.set_status(400)
            self.write({"error": "plan_id required"})
            return
        
        success = scheduler.set_manual_plan(plan_id)
        
        if success:
            # Apply slot assignments
            def update_slot(slot_num, person_name):
                slot = config.get_slot_by_number(slot_num)
                if slot:
                    slot['extended_name'] = person_name
                    config.update_slot(slot)
            
            scheduler.apply_current_slot_assignments(update_slot)
            
            self.write({
                "status": "success",
                "message": f"Manual plan {plan_id} set"
            })
        else:
            self.set_status(400)
            self.write({
                "status": "error",
                "message": "Cannot set manual plan - scheduled plan is currently live"
            })


class PCOClearManualPlanHandler(RequestHandler):
    """Clear manual plan override"""
    
    def post(self):
        scheduler = pco_scheduler.get_scheduler()
        if not scheduler:
            self.set_status(503)
            self.write({"error": "PCO scheduler not initialized"})
            return
        
        scheduler.clear_manual_plan()
        
        # Clear slot assignments if no plan is active
        current_plan = scheduler.get_current_plan()
        if not current_plan:
            for slot_num in range(1, 7):
                slot = config.get_slot_by_number(slot_num)
                if slot:
                    slot['extended_name'] = ''
                    config.update_slot(slot)
        
        self.write({
            "status": "success",
            "message": "Manual plan cleared"
        })


class PCORefreshScheduleHandler(RequestHandler):
    """Force refresh of the schedule"""
    
    def post(self):
        scheduler = pco_scheduler.get_scheduler()
        if not scheduler:
            self.set_status(503)
            self.write({"error": "PCO scheduler not initialized"})
            return
        
        # Get service types from config
        pco_config = config.config_tree.get('integrations', {}).get('planning_center', {})
        service_types = [st['id'] for st in pco_config.get('service_types', [])]
        
        if not service_types:
            # Fallback to default service types
            service_types = ['546904', '769651']  # CFC Sunday, CFC Wednesday
        
        scheduler.refresh_schedule(service_types)

        # Capture upcoming plans including slot_assignments for auditing
        plans = scheduler.get_upcoming_plans()

        # Apply current slot assignments
        def update_slot(slot_num, person_name):
            slot = config.get_slot_by_number(slot_num)
            if slot:
                slot['extended_name'] = person_name
                config.update_slot(slot)

        scheduler.apply_current_slot_assignments(update_slot)

        self.write({
            "status": "success",
            "message": "Schedule refreshed",
            "plan_count": len(plans),
            "plans": plans
        })


class PCOCurrentPlanHandler(RequestHandler):
    """Get the currently active plan"""
    
    def get(self):
        scheduler = pco_scheduler.get_scheduler()
        if not scheduler:
            self.set_status(503)
            self.write({"error": "PCO scheduler not initialized"})
            return
        
        current_plan = scheduler.get_current_plan()
        
        if current_plan:
            # Merge overrides before returning
            try:
                ov = get_slot_overrides(current_plan['plan_id'])
                if ov:
                    sa = current_plan.get('slot_assignments') or {}
                    sa.update(ov)
                    current_plan['slot_assignments'] = sa
            except Exception:
                pass
            self.write({
                "status": "success",
                "plan": current_plan,
                "is_scheduled": scheduler.current_live_plan is not None,
                "is_manual": scheduler.manual_override_plan is not None
            })
        else:
            self.write({
                "status": "success",
                "plan": None,
                "message": "No plan currently active"
            })


def init_pco_scheduler():
    """Initialize the PCO scheduler on server startup"""
    try:
        # Get PCO credentials from oauth_credentials section (where they're actually stored)
        oauth_creds = config.config_tree.get('oauth_credentials', {})
        
        # Try to get credentials from oauth_credentials
        client_id = oauth_creds.get('pco_client_id')
        client_secret = oauth_creds.get('pco_client_secret')
        
        # Fallback: use integrations.planning_center if oauth creds are not set yet
        if not client_id or not client_secret:
            pc_cfg = config.config_tree.get('integrations', {}).get('planning_center', {})
            client_id = client_id or pc_cfg.get('client_id')
            client_secret = client_secret or pc_cfg.get('client_secret')
        
        # Debug logging
        logging.info(f"OAuth credentials found: {bool(oauth_creds)}")
        logging.info(f"Client ID present: {bool(client_id)}")
        logging.info(f"Client Secret present: {bool(client_secret)}")
        
        if not client_id or not client_secret:
            logging.error("PCO credentials not configured in oauth_credentials section")
            logging.error(f"Available oauth keys: {list(oauth_creds.keys()) if oauth_creds else 'No oauth config'}")
            return False
        
        # Initialize scheduler
        scheduler = pco_scheduler.init_scheduler(client_id, client_secret)
        
        # Get service types from integrations.planning_center config
        pco_config = config.config_tree.get('integrations', {}).get('planning_center', {})
        service_types = [st['id'] for st in pco_config.get('service_types', [])]
        if not service_types:
            service_types = ['546904', '769651']  # Default service types
        
        # Configure slot mappings if available
        slot_mappings = {}
        for st in pco_config.get('service_types', []):
            # Get mappings from reuse_rules (name-based)
            for rule in st.get('reuse_rules', []):
                position_name = rule.get('position_name')
                slot_number = rule.get('slot')
                if position_name and slot_number:
                    slot_mappings[position_name] = slot_number
            
            # Note: ID-based mappings from teams/positions are handled dynamically
            # in _get_configured_mappings() since they require service-type-specific lookups
        
        if slot_mappings:
            scheduler.update_slot_mappings(slot_mappings)
            logging.info(f"Loaded {len(slot_mappings)} slot mappings from configuration")
        
        # Start the scheduler
        scheduler.start_scheduler(service_types)
        
        # Force an immediate refresh so plan-of-day is built right away
        try:
            scheduler.refresh_schedule(service_types)
        except Exception as e:
            logging.error(f"Error refreshing schedule after scheduler init: {e}")
        
        logging.info("PCO scheduler initialized and started")
        return True
        
    except Exception as e:
        logging.error(f"Failed to initialize PCO scheduler: {e}")
        return False


def shutdown_pco_scheduler():
    """Shutdown the PCO scheduler"""
    scheduler = pco_scheduler.get_scheduler()
    if scheduler:
        scheduler.stop_scheduler()
        logging.info("PCO scheduler stopped")


class PCOSetManualPlanHandler(RequestHandler):
    """Set a manual plan as current"""
    def post(self):
        try:
            data = json.loads(self.request.body.decode('utf-8'))
            plan_id = data.get('plan_id')
            
            if not plan_id:
                self.set_status(400)
                self.write(json.dumps({
                    'status': 'error',
                    'error': 'plan_id is required'
                }))
                return
            
            # Get the scheduler instance
            scheduler = pco_scheduler.get_scheduler()
            if not scheduler:
                self.set_status(500)
                self.write(json.dumps({
                    'status': 'error',
                    'error': 'Scheduler not initialized'
                }))
                return
            
            # Set the manual plan in the scheduler
            scheduler.set_manual_plan(plan_id)
            
            # Update slots with assignments
            current_plan = scheduler.get_current_plan()
            if current_plan and current_plan.get('slot_assignments'):
                self._update_slots(current_plan['slot_assignments'])
            
            self.write(json.dumps({
                'status': 'success',
                'message': f'Plan {plan_id} set as current',
                'slot_assignments': current_plan.get('slot_assignments', {}) if current_plan else {}
            }))
        except Exception as e:
            logging.error(f"Error setting manual plan: {e}")
            self.set_status(500)
            self.write(json.dumps({
                'status': 'error',
                'error': str(e)
            }))
    
    def _update_slots(self, slot_assignments: Dict[int, str]):
        """Update slot extended_names with assignments"""
        logging.info(f"Updating {len(slot_assignments)} slots with assignments")
        
        # Update assigned slots
        for slot_number, person_name in slot_assignments.items():
            try:
                slot_num = int(slot_number) if isinstance(slot_number, str) else slot_number
                update_data = {
                    'slot': slot_num,
                    'extended_name': person_name
                }
                config.update_slot(update_data)
                logging.info(f"Updated slot {slot_num} with name: {person_name}")
            except Exception as e:
                logging.error(f"Error updating slot {slot_number}: {e}")
        
        # Clear unassigned slots
        for slot in config.config_tree.get('slots', []):
            slot_number = slot['slot']
            if slot_number not in slot_assignments and slot.get('extended_name'):
                try:
                    update_data = {
                        'slot': slot_number,
                        'extended_name': ''
                    }
                    config.update_slot(update_data)
                    logging.info(f"Cleared name for slot {slot_number}")
                except Exception as e:
                    logging.error(f"Error clearing slot {slot_number}: {e}")


class PCOClearManualPlanHandler(RequestHandler):
    """Clear manual plan selection"""
    def post(self):
        try:
            scheduler = pco_scheduler.get_scheduler()
            if not scheduler:
                self.set_status(500)
                self.write(json.dumps({
                    'status': 'error',
                    'error': 'Scheduler not initialized'
                }))
                return
            
            scheduler.clear_manual_plan()
            
            # Clear all slot assignments
            for slot in config.config_tree.get('slots', []):
                if slot.get('extended_name'):
                    try:
                        update_data = {
                            'slot': slot['slot'],
                            'extended_name': ''
                        }
                        config.update_slot(update_data)
                    except Exception as e:
                        logging.error(f"Error clearing slot {slot['slot']}: {e}")
            
            self.write(json.dumps({
                'status': 'success',
                'message': 'Manual plan cleared'
            }))
        except Exception as e:
            logging.error(f"Error clearing manual plan: {e}")
            self.set_status(500)
            self.write(json.dumps({
                'status': 'error',
                'error': str(e)
            }))


class PCOSlotOverridesHandler(RequestHandler):
    """Get/set/clear manual slot overrides for a plan"""
    def get(self):
        try:
            plan_id = self.get_argument('plan_id', '')
            if not plan_id:
                self.set_status(400)
                self.write({"error": "plan_id required"})
                return
            self.write({"plan_id": plan_id, "overrides": get_slot_overrides(plan_id)})
        except Exception as e:
            self.set_status(500)
            self.write({"error": str(e)})

    def post(self):
        try:
            data = json.loads(self.request.body or b'{}')
            plan_id = data.get('plan_id')
            overrides_raw = data.get('overrides', {})
            if not plan_id or not isinstance(overrides_raw, dict):
                self.set_status(400)
                self.write({"error": "plan_id and overrides dict required"})
                return
            overrides = _normalize_overrides(overrides_raw)
            set_slot_overrides(plan_id, overrides)
            # If this plan is currently active, immediately apply overrides to config
            try:
                scheduler = pco_scheduler.get_scheduler()
                current_plan = scheduler.get_current_plan() if scheduler else None
                if current_plan and current_plan.get('plan_id') == plan_id:
                    for slot_num, person_name in overrides.items():
                        slot = config.get_slot_by_number(slot_num)
                        if slot is not None:
                            slot['extended_name'] = person_name
                            config.update_slot(slot)
                            # Push a live UI update via websocket
                            try:
                                import shure
                                import channel as channel_mod
                                ch = shure.get_network_device_by_slot(slot_num)
                                if ch and ch not in channel_mod.data_update_list:
                                    channel_mod.data_update_list.append(ch)
                            except Exception as _e2:
                                logging.error(f"WS push error for slot {slot_num}: {_e2}")
            except Exception as _e:
                logging.error(f"Error applying live overrides to config: {_e}")
            self.write({"status": "success", "plan_id": plan_id, "overrides": get_slot_overrides(plan_id)})
        except Exception as e:
            logging.error(f"slot override post error: {e}")
            self.set_status(500)
            self.write({"error": str(e)})

    def delete(self):
        try:
            data = json.loads(self.request.body or b'{}')
            plan_id = data.get('plan_id')
            slots = data.get('slots')  # optional list
            if not plan_id:
                self.set_status(400)
                self.write({"error": "plan_id required"})
                return
            clear_slot_overrides(plan_id, slots)
            # If this plan is currently active, restore PCO assignments
            try:
                scheduler = pco_scheduler.get_scheduler()
                current_plan = scheduler.get_current_plan() if scheduler else None
                if current_plan and current_plan.get('plan_id') == plan_id:
                    assignments = current_plan.get('slot_assignments', {})
                    if slots and isinstance(slots, list):
                        for s in slots:
                            try:
                                s_int = int(s)
                            except Exception:
                                continue
                            name = assignments.get(s_int, '')
                            slot = config.get_slot_by_number(s_int)
                            if slot is not None:
                                slot['extended_name'] = name
                                config.update_slot(slot)
                                # Push live update for this slot
                                try:
                                    import shure
                                    import channel as channel_mod
                                    ch = shure.get_network_device_by_slot(s_int)
                                    if ch and ch not in channel_mod.data_update_list:
                                        channel_mod.data_update_list.append(ch)
                                except Exception as _e2:
                                    logging.error(f"WS push error for slot {s_int}: {_e2}")
                    else:
                        def update_slot(slot_num, person_name):
                            slot = config.get_slot_by_number(slot_num)
                            if slot:
                                slot['extended_name'] = person_name
                                config.update_slot(slot)
                        scheduler.apply_current_slot_assignments(update_slot)
                        # Push updates for all standard slots 1..6
                        try:
                            import shure
                            import channel as channel_mod
                            for s_int in range(1, 7):
                                ch = shure.get_network_device_by_slot(s_int)
                                if ch and ch not in channel_mod.data_update_list:
                                    channel_mod.data_update_list.append(ch)
                        except Exception as _e3:
                            logging.error(f"WS bulk push error: {_e3}")
            except Exception as _e:
                logging.error(f"Error restoring assignments after clearing overrides: {_e}")
            self.write({"status": "success"})
        except Exception as e:
            logging.error(f"slot override delete error: {e}")
            self.set_status(500)
            self.write({"error": str(e)})
