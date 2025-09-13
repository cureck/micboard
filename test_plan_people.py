#!/usr/bin/env python3
"""
Test script to check the plan_people API response structure
"""

import sys
import os
sys.path.append('py')

import planning_center
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def test_plan_people_api():
    print("🔍 Testing plan_people API response structure...")
    print("=" * 60)
    
    service_type_id = "769651"
    plan_id = "81635160"  # The plan we saw in the PCO interface
    
    try:
        session = planning_center.get_pco_session()
        if not session:
            print("❌ No PCO session available")
            return
        
        # Test plan_people endpoint
        url = f"{planning_center.PCO_API_BASE}/service_types/{service_type_id}/plans/{plan_id}/plan_people"
        print(f"📡 Testing URL: {url}")
        
        response = session.get(url)
        if not response:
            print("❌ No response from plan_people endpoint")
            return
        
        print(f"✅ Response status: {response.status_code}")
        
        data = response.json()
        print(f"📊 Found {len(data.get('data', []))} assignments")
        
        # Show first few assignments to understand structure
        for i, assignment in enumerate(data.get('data', [])[:3]):
            print(f"\n📋 Assignment {i+1}:")
            print(f"   Raw data: {assignment}")
            
            # Check what fields are available
            if 'attributes' in assignment:
                attrs = assignment['attributes']
                print(f"   Attributes: {list(attrs.keys())}")
                print(f"   Person name: {attrs.get('name', 'N/A')}")
                print(f"   Position name: {attrs.get('team_position_name', 'N/A')}")
                print(f"   Status: {attrs.get('status', 'N/A')}")
            
            if 'relationships' in assignment:
                rels = assignment['relationships']
                print(f"   Relationships: {list(rels.keys())}")
                
                if 'person' in rels:
                    person_ref = rels['person']['data']
                    print(f"   Person ref: {person_ref}")
                
                if 'team_position' in rels:
                    tp_ref = rels['team_position']['data']
                    print(f"   Team position ref: {tp_ref}")
        
        # Check if we can find MIC positions
        print(f"\n🎤 Looking for MIC positions...")
        mic_assignments = []
        for assignment in data.get('data', []):
            attrs = assignment.get('attributes', {})
            position_name = attrs.get('team_position_name', '')
            if 'mic' in position_name.lower():
                mic_assignments.append({
                    'person': attrs.get('name', 'Unknown'),
                    'position': position_name,
                    'status': attrs.get('status', 'Unknown')
                })
        
        print(f"Found {len(mic_assignments)} MIC assignments:")
        for mic in mic_assignments:
            print(f"   - {mic['person']}: {mic['position']} ({mic['status']})")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_plan_people_api()
