"""Unit tests for Google Drive integration."""

import unittest
from unittest.mock import Mock, patch, MagicMock, mock_open
import os
import io

import google_drive


class TestGoogleDrive(unittest.TestCase):
    """Test cases for Google Drive integration."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.mock_config = {
            'integrations': {
                'google_drive': {
                    'tokens': {
                        'access_token': 'test_token',
                        'refresh_token': 'test_refresh'
                    },
                    'folder_id': 'test_folder_123'
                }
            }
        }
    
    @patch('google_drive.config.config_tree', new_callable=dict)
    def test_get_credentials_no_token(self, mock_config_tree):
        """Test getting credentials without tokens."""
        mock_config_tree.update({'integrations': {}})
        creds = google_drive.get_credentials()
        self.assertIsNone(creds)
    
    @patch('google_drive.config.config_tree', new_callable=dict)
    @patch('google_drive.Credentials')
    def test_get_credentials_with_token(self, mock_creds_class, mock_config_tree):
        """Test getting credentials with valid tokens."""
        mock_config_tree.update(self.mock_config)
        mock_creds = Mock()
        mock_creds.expired = False
        mock_creds_class.return_value = mock_creds
        
        creds = google_drive.get_credentials()
        self.assertEqual(creds, mock_creds)
        mock_creds_class.assert_called_once()
    
    @patch('google_drive.config.save_current_config')
    @patch('google_drive.config.config_tree', new_callable=dict)
    @patch('google_drive.Request')
    @patch('google_drive.Credentials')
    def test_get_credentials_refresh(self, mock_creds_class, mock_request, mock_config_tree, mock_save):
        """Test credentials refresh when expired."""
        mock_config_tree.update(self.mock_config)
        
        mock_creds = Mock()
        mock_creds.expired = True
        mock_creds.refresh_token = 'test_refresh'
        mock_creds.token = 'new_token'
        mock_creds_class.return_value = mock_creds
        
        creds = google_drive.get_credentials()
        
        self.assertEqual(creds, mock_creds)
        mock_creds.refresh.assert_called_once()
        mock_save.assert_called_once()
    
    @patch('google_drive.get_credentials')
    @patch('google_drive.build')
    def test_get_drive_service(self, mock_build, mock_get_creds):
        """Test getting Drive service."""
        mock_creds = Mock()
        mock_get_creds.return_value = mock_creds
        mock_service = Mock()
        mock_build.return_value = mock_service
        
        service = google_drive.get_drive_service()
        
        self.assertEqual(service, mock_service)
        mock_build.assert_called_once_with('drive', 'v3', credentials=mock_creds)
    
    @patch('google_drive.config.get_gif_dir')
    @patch('builtins.open', new_callable=mock_open)
    @patch('google_drive.MediaIoBaseDownload')
    def test_download_file(self, mock_downloader_class, mock_file, mock_gif_dir):
        """Test downloading a file from Drive."""
        mock_gif_dir.return_value = '/test/backgrounds'
        mock_service = Mock()
        
        # Mock the downloader
        mock_downloader = Mock()
        mock_downloader.next_chunk.side_effect = [(Mock(progress=lambda: 0.5), False), (Mock(), True)]
        mock_downloader_class.return_value = mock_downloader
        
        # Mock file content
        mock_fh = io.BytesIO(b'test image data')
        
        with patch('google_drive.io.BytesIO', return_value=mock_fh):
            result = google_drive.download_file(mock_service, 'file123', 'Test Image.jpg', 'image/jpeg')
        
        self.assertTrue(result)
        mock_file.assert_called_once_with('/test/backgrounds/test image.jpg', 'wb')
    
    def test_get_csv_mapping(self):
        """Test loading CSV mappings."""
        mock_service = Mock()
        
        # Mock Drive API responses
        mock_service.files().list().execute.return_value = {
            'files': [{'id': 'csv123'}]
        }
        
        # Mock CSV content
        csv_content = b'original.jpg,renamed.jpg\nphoto2.png,person name.png'
        mock_fh = io.BytesIO(csv_content)
        
        # Mock downloader
        mock_downloader = Mock()
        mock_downloader.next_chunk.return_value = (Mock(), True)
        
        with patch('google_drive.MediaIoBaseDownload', return_value=mock_downloader):
            with patch('google_drive.io.BytesIO', return_value=mock_fh):
                mappings = google_drive.get_csv_mapping(mock_service, 'folder123')
        
        expected = {
            'original.jpg': 'renamed.jpg',
            'photo2.png': 'person name.png'
        }
        self.assertEqual(mappings, expected)
    
    @patch('google_drive.config.get_gif_dir')
    @patch('google_drive.download_file')
    @patch('google_drive.get_csv_mapping')
    @patch('google_drive.get_drive_service')
    @patch('google_drive.config.config_tree', new_callable=dict)
    def test_sync_drive_files(self, mock_config_tree, mock_get_service, mock_get_csv, mock_download, mock_gif_dir):
        """Test syncing files from Drive."""
        mock_config_tree.update(self.mock_config)
        mock_gif_dir.return_value = '/test/backgrounds'
        
        mock_service = Mock()
        mock_get_service.return_value = mock_service
        
        # Mock CSV mappings
        mock_get_csv.return_value = {'original.jpg': 'renamed.jpg'}
        
        # Mock file list from Drive
        mock_service.files().list().execute.return_value = {
            'files': [
                {
                    'id': 'file1',
                    'name': 'original.jpg',
                    'mimeType': 'image/jpeg',
                    'modifiedTime': '2023-01-01T00:00:00Z'
                },
                {
                    'id': 'file2',
                    'name': 'new_photo.png',
                    'mimeType': 'image/png',
                    'modifiedTime': '2023-01-02T00:00:00Z'
                }
            ]
        }
        
        # Clear last file state
        google_drive._last_file_state = {}
        
        # Mock download success
        mock_download.return_value = True
        
        # Run sync
        google_drive.sync_drive_files()
        
        # Verify downloads
        self.assertEqual(mock_download.call_count, 2)
        mock_download.assert_any_call(mock_service, 'file1', 'renamed.jpg', 'image/jpeg')
        mock_download.assert_any_call(mock_service, 'file2', 'new_photo', 'image/png')
    
    @patch('os.remove')
    @patch('os.path.exists')
    @patch('google_drive.config.get_gif_dir')
    @patch('google_drive.get_drive_service')
    @patch('google_drive.config.config_tree', new_callable=dict)
    def test_sync_drive_files_delete(self, mock_config_tree, mock_get_service, mock_gif_dir, mock_exists, mock_remove):
        """Test deleting local files that no longer exist in Drive."""
        mock_config_tree.update(self.mock_config)
        mock_gif_dir.return_value = '/test/backgrounds'
        
        mock_service = Mock()
        mock_get_service.return_value = mock_service
        
        # Set previous state with a file that no longer exists
        google_drive._last_file_state = {
            'deleted_file': {'id': 'old_file', 'modified': '2023-01-01T00:00:00Z'}
        }
        
        # Mock empty file list from Drive
        mock_service.files().list().execute.return_value = {'files': []}
        
        # Mock file exists
        mock_exists.return_value = True
        
        # Run sync
        google_drive.sync_drive_files()
        
        # Verify file was deleted
        mock_remove.assert_called()
    
    @patch('google_drive.sync_drive_files')
    @patch('time.sleep')
    def test_sync_thread_worker(self, mock_sleep, mock_sync):
        """Test the sync thread worker."""
        # Set up stop event to trigger after first iteration
        def sleep_side_effect(duration):
            if duration == 60:
                google_drive._sync_stop_event.set()
            return None
        
        mock_sleep.side_effect = sleep_side_effect
        
        # Run worker
        google_drive.sync_thread_worker()
        
        # Verify sync was called
        mock_sync.assert_called_once()


if __name__ == '__main__':
    unittest.main()
