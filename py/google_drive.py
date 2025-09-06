"""Google Drive integration for Micboard background images."""

import os
import logging
import threading
import time
import csv
import io
from typing import Dict, List, Optional

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

import config

# Google OAuth configuration
def get_google_credentials():
    """Get Google credentials from environment or config."""
    client_id = os.environ.get('GOOGLE_CLIENT_ID')
    client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
    
    # If not in environment, try config
    if not client_id or not client_secret:
        try:
            oauth_creds = config.config_tree.get('oauth_credentials', {})
            client_id = oauth_creds.get('google_client_id')
            client_secret = oauth_creds.get('google_client_secret')
        except AttributeError:
            # config_tree not loaded yet
            pass
    
    return client_id or '', client_secret or ''

# Don't call get_google_credentials at module level to avoid circular import
GOOGLE_REDIRECT_URI = os.environ.get('GOOGLE_REDIRECT_URI', 'http://localhost:8058/api/drive/callback')
GOOGLE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

# Global sync thread control
_sync_thread = None
_sync_stop_event = threading.Event()
_last_file_state = {}
_downloading_files = set()  # Track files currently being downloaded


def get_last_file_state():
    """Get the current file state for status checking."""
    return _last_file_state.copy()


def get_downloading_files():
    """Get the set of files currently being downloaded."""
    return _downloading_files.copy()


def get_credentials() -> Optional[Credentials]:
    """Get Google Drive credentials from config."""
    drive_config = config.config_tree.get('integrations', {}).get('google_drive', {})
    tokens = drive_config.get('tokens', {})
    
    if not tokens.get('access_token'):
        logging.warning("No Google Drive access token available")
        return None
    
    # Get current credentials (may have been updated via UI)
    client_id, client_secret = get_google_credentials()
    
    if not client_id or not client_secret:
        logging.error("Google Drive credentials not configured")
        return None
    
    creds = Credentials(
        token=tokens.get('access_token'),
        refresh_token=tokens.get('refresh_token'),
        token_uri='https://oauth2.googleapis.com/token',
        client_id=client_id,
        client_secret=client_secret,
        scopes=GOOGLE_SCOPES
    )
    
    # Refresh if needed
    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            
            # Save refreshed tokens
            if 'integrations' not in config.config_tree:
                config.config_tree['integrations'] = {}
            if 'google_drive' not in config.config_tree['integrations']:
                config.config_tree['integrations']['google_drive'] = {}
            
            config.config_tree['integrations']['google_drive']['tokens'] = {
                'access_token': creds.token,
                'refresh_token': creds.refresh_token
            }
            config.save_current_config()
            logging.info("Google Drive tokens refreshed and saved")
        except Exception as e:
            logging.error(f"Error refreshing Google Drive tokens: {e}")
            return None
    
    return creds


def get_drive_service():
    """Get authenticated Google Drive service."""
    creds = get_credentials()
    if not creds:
        return None
    
    try:
        return build('drive', 'v3', credentials=creds)
    except Exception as e:
        logging.error(f"Error building Drive service: {e}")
        return None


def download_file(service, file_id: str, file_name: str, mime_type: str) -> bool:
    """Download a file from Google Drive."""
    try:
        backgrounds_dir = config.get_gif_dir()
        
        # Determine file extension
        ext_map = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'video/mp4': '.mp4'
        }
        
        # Use mime type to determine extension, or keep original
        if mime_type in ext_map and not file_name.lower().endswith(tuple(ext_map.values())):
            file_name = os.path.splitext(file_name)[0] + ext_map[mime_type]
        
        file_path = os.path.join(backgrounds_dir, file_name.lower())
        
        # Download file
        request = service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        
        while not done:
            status, done = downloader.next_chunk()
            if status:
                logging.debug(f"Download {int(status.progress() * 100)}% complete")
        
        # Write to file
        with open(file_path, 'wb') as f:
            f.write(fh.getvalue())
        
        logging.info(f"Downloaded {file_name} to {file_path}")
        return True
        
    except Exception as e:
        logging.error(f"Error downloading file {file_name}: {e}")
        return False


def get_csv_mapping(service, folder_id: str) -> Dict[str, str]:
    """Load name mappings from CSV file if present."""
    mappings = {}
    
    try:
        # Look for mapping.csv in the folder
        query = f"'{folder_id}' in parents and name = 'mapping.csv' and trashed = false"
        results = service.files().list(q=query, fields="files(id)").execute()
        files = results.get('files', [])
        
        if not files:
            return mappings
        
        # Download CSV content
        csv_file_id = files[0]['id']
        request = service.files().get_media(fileId=csv_file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        
        while not done:
            status, done = downloader.next_chunk()
        
        # Parse CSV
        csv_content = fh.getvalue().decode('utf-8')
        csv_reader = csv.reader(io.StringIO(csv_content))
        
        for row in csv_reader:
            if len(row) >= 2:
                # First column is Google Drive filename, second is local filename
                mappings[row[0].strip()] = row[1].strip()
        
        logging.info(f"Loaded {len(mappings)} name mappings from CSV")
        
    except Exception as e:
        logging.error(f"Error loading CSV mappings: {e}")
    
    return mappings


def sync_drive_files():
    """Sync background images from Google Drive."""
    global _last_file_state
    
    drive_config = config.config_tree.get('integrations', {}).get('google_drive', {})
    folder_id = drive_config.get('folder_id')
    
    if not folder_id:
        logging.debug("Drive sync skipped - no folder ID configured")
        return
    
    service = get_drive_service()
    if not service:
        return
    
    try:
        # Get CSV mappings if available
        csv_mappings = get_csv_mapping(service, folder_id)
        
        # List all image/video files in the folder
        query = f"'{folder_id}' in parents and trashed = false and ("
        query += "mimeType contains 'image/' or mimeType = 'video/mp4')"
        
        results = service.files().list(
            q=query,
            fields="files(id, name, mimeType, modifiedTime)",
            pageSize=1000
        ).execute()
        
        files = results.get('files', [])
        current_files = {}
        backgrounds_dir = config.get_gif_dir()
        
        # Process each file
        for file in files:
            file_id = file['id']
            original_name = file['name']
            mime_type = file['mimeType']
            modified_time = file['modifiedTime']
            
            # Apply CSV mapping if available
            if original_name in csv_mappings:
                local_name = csv_mappings[original_name]
            else:
                # Use original name, removing extension if needed
                local_name = os.path.splitext(original_name)[0]
            
            # Track current files
            current_files[local_name.lower()] = {
                'id': file_id,
                'modified': modified_time,
                'mime_type': mime_type,
                'original_name': original_name
            }
            
            # Check if we need to download
            if local_name.lower() not in _last_file_state or \
               _last_file_state[local_name.lower()]['modified'] != modified_time:
                logging.info(f"Downloading new/updated file: {original_name} -> {local_name}")
                _downloading_files.add(local_name.lower())
                try:
                    download_file(service, file_id, local_name, mime_type)
                finally:
                    _downloading_files.discard(local_name.lower())
        
        # Remove files that no longer exist in Drive
        for filename in list(_last_file_state.keys()):
            if filename not in current_files:
                # Remove local file
                for ext in ['.jpg', '.jpeg', '.png', '.gif', '.mp4']:
                    file_path = os.path.join(backgrounds_dir, filename + ext)
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        logging.info(f"Removed {file_path} (no longer in Drive)")
        
        _last_file_state = current_files
        logging.info(f"Drive sync complete - {len(current_files)} files tracked")
        
    except Exception as e:
        logging.error(f"Error syncing Drive files: {e}")


def sync_thread_worker():
    """Worker thread that runs Drive sync periodically."""
    # Initial sync after 5 seconds
    time.sleep(5)
    
    while not _sync_stop_event.is_set():
        try:
            sync_drive_files()
        except Exception as e:
            logging.error(f"Drive sync error: {e}")
        
        # Sleep for 1 hour, checking for stop event every minute
        for _ in range(60):
            if _sync_stop_event.is_set():
                break
            time.sleep(60)
    
    logging.info("Drive sync thread stopped")


def start_sync_thread():
    """Start the Drive sync thread."""
    global _sync_thread
    
    if _sync_thread and _sync_thread.is_alive():
        logging.warning("Drive sync thread already running")
        return
    
    _sync_stop_event.clear()
    _sync_thread = threading.Thread(target=sync_thread_worker, daemon=True)
    _sync_thread.start()
    logging.info("Drive sync thread started")


def stop_sync_thread():
    """Stop the Drive sync thread."""
    global _sync_thread
    
    if not _sync_thread:
        return
    
    _sync_stop_event.set()
    _sync_thread.join(timeout=5)
    _sync_thread = None
    logging.info("Drive sync thread stopped")
