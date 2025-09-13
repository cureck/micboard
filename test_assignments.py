#!/usr/bin/env python3
"""
Test script to check PCO assignments for service type 769651
"""

import sys
import os
sys.path.append('py')

import planning_center
import config
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def test_assignments_for_service_type(service_type_id):
    print(f"🔍 Testing assignments for service type: {service_type_id}")
    print("=" * 60)
    
    # Get the current plan for this service type
    try:
        plan = planning_center.find_live_plan(service_type_id, lead_time_hours=2)
        if not plan:
            print(f"❌ No plan found for service type {service_type_id}")
            return
        
        print(f"✅ Found plan: {plan['id']} - {plan.get('title', 'No title')}")
        print(f"   Service time: {plan.get('service_time', 'No service time')}")
        print(f"   Live time: {plan.get('live_time', 'No live time')}")
        
        # Get team members for this plan
        session = planning_center.get_pco_session()
        if not session:
            print("❌ No PCO session available")
            return
        
        url = f"{planning_center.PCO_API_BASE}/service_types/{service_type_id}/plans/{plan['id']}/team_members"
        params = {'include': 'person,team_position'}
        response = session.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        print(f"\n📋 Team Members in Plan:")
        print(f"   Total members: {len(data.get('data', []))}")
        
        # Group by team and position
        assignments_by_team = {}
        for member in data.get('data', []):
            # Get team name
            team_ref = member['relationships'].get('team', {}).get('data')
            team_name = 'Unknown'
            if team_ref:
                team_id = team_ref['id']
                teams_url = f"{planning_center.PCO_API_BASE}/teams/{team_id}"
                team_response = session.get(teams_url)
                team_response.raise_for_status()
                team_data = team_response.json()
                team_name = team_data['data']['attributes']['name']
            
            # Get position name
            position_ref = member['relationships'].get('team_position', {}).get('data')
            position_name = 'Unknown'
            if position_ref:
                position_id = position_ref['id']
                positions_url = f"{planning_center.PCO_API_BASE}/team_positions/{position_id}"
                position_response = session.get(positions_url)
                position_response.raise_for_status()
                position_data = position_response.json()
                position_name = position_data['data']['attributes']['name']
            
            # Get person name
            person_name = 'Unknown'
            person_ref = member['relationships']['person']['data']
            person_key = f"{person_ref['type']}-{person_ref['id']}"
            
            included = {}
            for item in data.get('included', []):
                key = f"{item['type']}-{item['id']}"
                included[key] = item
            
            person_data = included.get(person_key)
            if person_data:
                person_name = person_data['attributes'].get('name') or person_data['attributes'].get('full_name', 'Unknown')
            
            # Store assignment
            if team_name not in assignments_by_team:
                assignments_by_team[team_name] = {}
            assignments_by_team[team_name][position_name] = person_name
        
        # Display assignments
        for team_name, positions in assignments_by_team.items():
            print(f"\n   🎵 {team_name}:")
            for position_name, person_name in positions.items():
                print(f"      - {position_name}: {person_name}")
        
        # Check specifically for Mic positions
        print(f"\n🎤 Mic Positions:")
        mic_assignments = []
        for team_name, positions in assignments_by_team.items():
            for position_name, person_name in positions.items():
                if 'mic' in position_name.lower():
                    mic_assignments.append((team_name, position_name, person_name))
                    print(f"   ✅ {team_name} - {position_name}: {person_name}")
        
        if not mic_assignments:
            print("   ❌ No Mic positions found in assignments")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    service_type_id = "769651"
    if len(sys.argv) > 1:
        service_type_id = sys.argv[1]
    
    test_assignments_for_service_type(service_type_id)
