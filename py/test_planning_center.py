"""Unit tests for Planning Center integration."""

import unittest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta, timezone
import json

import planning_center


class TestPlanningCenter(unittest.TestCase):
    """Test cases for Planning Center integration."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.mock_config = {
            'integrations': {
                'planning_center': {
                    'tokens': {
                        'access_token': 'test_token',
                        'refresh_token': 'test_refresh'
                    },
                    'lead_time_hours': 2,
                    'service_types': [
                        {
                            'id': 'service1',
                            'teams': [
                                {
                                    'id': 'team1',
                                    'positions': [
                                        {'id': 'pos1', 'slot': 1}
                                    ]
                                }
                            ],
                            'reuse_rules': [
                                {
                                    'team_name': 'Band',
                                    'position_name': 'Mic 1',
                                    'slot': 2
                                }
                            ]
                        }
                    ]
                }
            },
            'slots': [
                {'slot': 1, 'type': 'uhfr'},
                {'slot': 2, 'type': 'qlxd'}
            ]
        }
    
    @patch('planning_center.config.config_tree', new_callable=dict)
    def test_get_pco_session_no_token(self, mock_config_tree):
        """Test getting PCO session without tokens."""
        mock_config_tree.update({'integrations': {}})
        session = planning_center.get_pco_session()
        self.assertIsNone(session)
    
    @patch('planning_center.config.config_tree', new_callable=dict)
    @patch('planning_center.OAuth2Session')
    def test_get_pco_session_with_token(self, mock_oauth, mock_config_tree):
        """Test getting PCO session with valid tokens."""
        mock_config_tree.update(self.mock_config)
        mock_session = Mock()
        mock_oauth.return_value = mock_session
        
        session = planning_center.get_pco_session()
        self.assertEqual(session, mock_session)
        mock_oauth.assert_called_once()
    
    def test_find_assignment_by_id(self):
        """Test finding assignment by ID-based mapping."""
        mock_response = {
            'data': [
                {
                    'id': 'member1',
                    'attributes': {'status': 'confirmed'},
                    'relationships': {
                        'person': {'data': {'type': 'Person', 'id': 'person1'}},
                        'team_position': {'data': {'type': 'TeamPosition', 'id': 'pos1'}}
                    }
                }
            ],
            'included': [
                {
                    'type': 'Person',
                    'id': 'person1',
                    'attributes': {'name': 'John Doe'}
                },
                {
                    'type': 'TeamPosition',
                    'id': 'pos1',
                    'attributes': {'name': 'Lead Vocals'},
                    'relationships': {'team': {'data': {'id': 'team1'}}}
                }
            ]
        }
        
        with patch('planning_center.get_pco_session') as mock_session:
            mock_session.return_value.get.return_value.json.return_value = mock_response
            mock_session.return_value.get.return_value.raise_for_status = Mock()
            
            mapping = {
                'service_type_id': 'service1',
                'team_id': 'team1',
                'position_id': 'pos1'
            }
            
            result = planning_center._find_assignment('plan1', 'service1', mapping)
            self.assertEqual(result, 'John Doe')
    
    def test_find_assignment_by_name(self):
        """Test finding assignment by name-based mapping."""
        mock_response = {
            'data': [
                {
                    'id': 'member1',
                    'attributes': {'status': 'accepted'},
                    'relationships': {
                        'person': {'data': {'type': 'Person', 'id': 'person2'}},
                        'team_position': {'data': {'type': 'TeamPosition', 'id': 'pos2'}}
                    }
                }
            ],
            'included': [
                {
                    'type': 'Person',
                    'id': 'person2',
                    'attributes': {'name': 'Jane Smith'}
                },
                {
                    'type': 'TeamPosition',
                    'id': 'pos2',
                    'attributes': {'name': 'Mic 1'},
                    'relationships': {'team': {'data': {'id': 'team2'}}}
                }
            ]
        }
        
        mock_team_response = {
            'data': {
                'id': 'team2',
                'attributes': {'name': 'Band'}
            }
        }
        
        with patch('planning_center.get_pco_session') as mock_session:
            # Mock the team members response
            mock_get = mock_session.return_value.get
            mock_get.return_value.json.side_effect = [mock_response, mock_team_response]
            mock_get.return_value.raise_for_status = Mock()
            
            mapping = {
                'team_name': 'Band',
                'position_name': 'Mic 1'
            }
            
            result = planning_center._find_assignment('plan1', 'service1', mapping)
            self.assertEqual(result, 'Jane Smith')
    
    def test_find_assignment_invalid_status(self):
        """Test that assignments with invalid status are ignored."""
        mock_response = {
            'data': [
                {
                    'id': 'member1',
                    'attributes': {'status': 'declined'},  # Invalid status
                    'relationships': {
                        'person': {'data': {'type': 'Person', 'id': 'person1'}},
                        'team_position': {'data': {'type': 'TeamPosition', 'id': 'pos1'}}
                    }
                }
            ],
            'included': []
        }
        
        with patch('planning_center.get_pco_session') as mock_session:
            mock_session.return_value.get.return_value.json.return_value = mock_response
            mock_session.return_value.get.return_value.raise_for_status = Mock()
            
            mapping = {
                'service_type_id': 'service1',
                'team_id': 'team1',
                'position_id': 'pos1'
            }
            
            result = planning_center._find_assignment('plan1', 'service1', mapping)
            self.assertIsNone(result)
    
    def test_find_live_plan(self):
        """Test finding a live plan within lead time."""
        now = datetime.now(timezone.utc)
        plan_time = now + timedelta(hours=1)  # 1 hour from now
        
        mock_plans_response = {
            'data': [
                {
                    'id': 'plan1',
                    'attributes': {
                        'title': 'Sunday Service',
                        'dates': 'Dec 25'
                    }
                }
            ]
        }
        
        mock_times_response = {
            'data': [
                {
                    'attributes': {
                        'starts_at': plan_time.isoformat()
                    }
                }
            ]
        }
        
        with patch('planning_center.get_pco_session') as mock_session:
            mock_get = mock_session.return_value.get
            mock_get.return_value.json.side_effect = [mock_plans_response, mock_times_response]
            mock_get.return_value.raise_for_status = Mock()
            
            result = planning_center.find_live_plan('service1', 2)
            
            self.assertIsNotNone(result)
            self.assertEqual(result['id'], 'plan1')
            self.assertEqual(result['title'], 'Sunday Service')
    
    @patch('planning_center.config.update_slot')
    @patch('planning_center.config.config_tree', new_callable=dict)
    @patch('planning_center._find_assignment')
    @patch('planning_center.find_live_plan')
    def test_sync_assignments(self, mock_find_plan, mock_find_assignment, mock_config_tree, mock_update_slot):
        """Test the sync_assignments function."""
        mock_config_tree.update(self.mock_config)
        
        # Mock live plan
        mock_find_plan.return_value = {
            'id': 'plan1',
            'service_type_id': 'service1'
        }
        
        # Mock assignments
        mock_find_assignment.side_effect = ['John Doe', 'Jane Smith']
        
        # Clear last assignment state
        planning_center._last_assignment_state = {}
        
        # Run sync
        planning_center.sync_assignments()
        
        # Verify update_slot was called
        self.assertEqual(mock_update_slot.call_count, 2)
        mock_update_slot.assert_any_call({'slot': 1, 'extended_name': 'John Doe'})
        mock_update_slot.assert_any_call({'slot': 2, 'extended_name': 'Jane Smith'})
    
    @patch('planning_center.config.update_slot')
    @patch('planning_center.config.config_tree', new_callable=dict)
    @patch('planning_center._find_assignment')
    @patch('planning_center.find_live_plan')
    def test_sync_assignments_clear_names(self, mock_find_plan, mock_find_assignment, mock_config_tree, mock_update_slot):
        """Test clearing slot names when no assignment found."""
        mock_config_tree.update(self.mock_config)
        
        # Set previous state
        planning_center._last_assignment_state = {1: 'Old Name'}
        
        # Mock live plan
        mock_find_plan.return_value = {
            'id': 'plan1',
            'service_type_id': 'service1'
        }
        
        # Mock no assignments found
        mock_find_assignment.return_value = None
        
        # Run sync
        planning_center.sync_assignments()
        
        # Verify slot was cleared
        mock_update_slot.assert_called_with({'slot': 1, 'extended_name': ''})


if __name__ == '__main__':
    unittest.main()
