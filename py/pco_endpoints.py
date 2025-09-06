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
            "plan_count": len(scheduler.get_upcoming_plans())
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
        # Get PCO credentials from config or environment
        pco_config = config.config_tree.get('integrations', {}).get('planning_center', {})
        
        # Try to get credentials from config
        client_id = pco_config.get('client_id')
        client_secret = pco_config.get('client_secret')
        
        # Fallback to hardcoded values (should be moved to config)
        if not client_id or not client_secret:
            client_id = 'bd988f71a7fa77b98ca5f6f71e39c3cd1a1c8cffa397c244efdba11791802cc0'
            client_secret = 'pco_pat_800c9c5c6222246936e8d2bc3659357fa6f6a28d4ca30584f5a5227e3a26c88b042539bd'
        
        # Initialize scheduler
        scheduler = pco_scheduler.init_scheduler(client_id, client_secret)
        
        # Get service types
        service_types = [st['id'] for st in pco_config.get('service_types', [])]
        if not service_types:
            service_types = ['546904', '769651']  # Default service types
        
        # Configure slot mappings if available
        slot_mappings = {}
        for st in pco_config.get('service_types', []):
            for rule in st.get('reuse_rules', []):
                position_name = rule.get('position_name')
                slot_number = rule.get('slot')
                if position_name and slot_number:
                    slot_mappings[position_name] = slot_number
        
        if slot_mappings:
            scheduler.update_slot_mappings(slot_mappings)
        
        # Start the scheduler
        scheduler.start_scheduler(service_types)
        
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
