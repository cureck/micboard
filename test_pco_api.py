#!/usr/bin/env python3
"""Test script to check Planning Center API response."""

import requests
import json
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)

# PCO API configuration
PCO_API_BASE = 'https://api.planningcenteronline.com/services/v2'
CLIENT_ID = 'bd988f71a7fa77b98ca5f6f71e39c3cd1a1c8cffa397c244efdba11791802cc0'
CLIENT_SECRET = 'pco_pat_800c9c5c6222246936e8d2bc3659357fa6f6a28d4ca30584f5a5227e3a26c88b042539bd'

def get_pco_session():
    """Create a PCO session with Personal Access Token authentication."""
    session = requests.Session()
    # Use Basic Authentication with Client ID as username and Client Secret as password
    session.auth = (CLIENT_ID, CLIENT_SECRET)
    session.headers.update({
        'X-PCO-API-Version': '2023-08-01'
    })
    return session

def test_team_members():
    """Test getting team members for the current plan."""
    session = get_pco_session()
    
    # Test parameters
    service_type_id = '120155'
    plan_id = '82549745'
    
    try:
        # Get team memberships with person and position info
        url = f"{PCO_API_BASE}/service_types/{service_type_id}/plans/{plan_id}/team_members"
        params = {'include': 'person,team_position'}
        response = session.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        print(f"API Response Status: {response.status_code}")
        print(f"Total team members: {len(data.get('data', []))}")
        
        # Build included data lookup
        included = {}
        for item in data.get('included', []):
            key = f"{item['type']}-{item['id']}"
            included[key] = item
        
        # Check each team member
        for i, member in enumerate(data.get('data', [])):
            if i == 0:  # Just look at the first one for debugging
                print(f"\nRaw data for Team Member {i+1}:")
                print(json.dumps(member, indent=2))
                break
            
            status = member['attributes']['status']
            print(f"\nTeam Member {i+1}:")
            print(f"  Status: {status}")
            
            # Get position info
            position_ref = member['relationships'].get('team_position', {}).get('data')
            if position_ref:
                position_key = f"{position_ref['type']}-{position_ref['id']}"
                position_data = included.get(position_key)
                if position_data:
                    position_name = position_data['attributes']['name']
                    team_id = position_data['relationships']['team']['data']['id']
                    print(f"  Position: {position_name}")
                    print(f"  Team ID: {team_id}")
                    
                    # Get team name
                    teams_url = f"{PCO_API_BASE}/teams/{team_id}"
                    team_response = session.get(teams_url)
                    team_response.raise_for_status()
                    team_data = team_response.json()
                    team_name = team_data['data']['attributes']['name']
                    print(f"  Team Name: {team_name}")
                    
                    # Check if this matches our slot mapping
                    if team_name == 'Vocals' and position_name == 'Worship Leader':
                        print(f"  *** MATCHES SLOT MAPPING ***")
                        
                        # Get person info
                        person_ref = member['relationships']['person']['data']
                        person_key = f"{person_ref['type']}-{person_ref['id']}"
                        person_data = included.get(person_key)
                        if person_data:
                            person_name = person_data['attributes']['name']
                            print(f"  Person Name: {person_name}")
            else:
                print(f"  No team position relationship")
            
            # Get person info
            person_ref = member['relationships'].get('person', {}).get('data')
            if person_ref:
                person_key = f"{person_ref['type']}-{person_ref['id']}"
                person_data = included.get(person_key)
                if person_data:
                    person_name = person_data['attributes']['name']
                    print(f"  Person: {person_name}")
            else:
                print(f"  No person relationship")
        
        return data
        
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    print("Testing Planning Center API...")
    result = test_team_members()
    if result:
        print("\nFull API Response:")
        print(json.dumps(result, indent=2))
