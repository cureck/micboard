#!/usr/bin/env python3
"""
Debug script for service type 769651
This script will test the PCO API calls directly to see what's happening
"""

import sys
import os
sys.path.append('py')

import planning_center
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def debug_service_type(service_type_id):
    print(f"🔍 Debugging service type: {service_type_id}")
    print("=" * 50)
    
    # Test 1: Get teams for this service type
    print("\n1️⃣ Testing get_teams_for_service_type...")
    try:
        teams = planning_center.get_teams_for_service_type(service_type_id)
        print(f"✅ Found {len(teams)} teams:")
        for team in teams:
            print(f"   - {team['name']} (ID: {team['id']})")
    except Exception as e:
        print(f"❌ Error getting teams: {e}")
        return
    
    # Test 2: For each team, get positions
    print(f"\n2️⃣ Testing positions for each team...")
    all_positions = []
    for team in teams:
        team_id = team['id']
        team_name = team['name']
        print(f"\n   Team: {team_name} (ID: {team_id})")
        
        try:
            positions = planning_center.get_positions_for_team_in_service_type(service_type_id, team_id)
            print(f"   ✅ Found {len(positions)} positions:")
            for pos in positions:
                print(f"      - {pos['name']} (ID: {pos['id']})")
            all_positions.extend(positions)
        except Exception as e:
            print(f"   ❌ Error getting positions: {e}")
    
    # Test 3: Test the get_positions function (used by the API)
    print(f"\n3️⃣ Testing get_positions function...")
    if teams:
        test_team_name = teams[0]['name']
        print(f"   Testing with team: {test_team_name}")
        try:
            positions = planning_center.get_positions([service_type_id], test_team_name)
            print(f"   ✅ Found {len(positions)} positions via get_positions:")
            for pos in positions:
                print(f"      - {pos['name']} (ID: {pos['id']}, Service Type: {pos.get('service_type_id', 'Unknown')})")
        except Exception as e:
            print(f"   ❌ Error in get_positions: {e}")
    
    print(f"\n📊 Summary:")
    print(f"   - Teams found: {len(teams)}")
    print(f"   - Total positions found: {len(all_positions)}")
    
    if len(all_positions) == 0:
        print(f"\n⚠️  No positions found! This could be because:")
        print(f"   - The service type has no teams")
        print(f"   - The teams have no positions")
        print(f"   - There's an API permission issue")
        print(f"   - The service type ID is incorrect")

if __name__ == "__main__":
    service_type_id = "769651"
    if len(sys.argv) > 1:
        service_type_id = sys.argv[1]
    
    debug_service_type(service_type_id)
