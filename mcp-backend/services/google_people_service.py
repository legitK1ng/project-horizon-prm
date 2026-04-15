"""
Google People API Service — Phase 5 | REQ-031
Handles fetching and mapping contacts from Google People API to Supabase.
"""
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from typing import List, Dict, Any
from datetime import datetime, timezone
import logging
import uuid
from core.utils import generate_stable_uuid

import os
import httpx

logger = logging.getLogger(__name__)

class GooglePeopleServiceError(Exception):
    pass

class GooglePeopleService:

    def __init__(self, supabase_client):
        self.supabase = supabase_client
        self.client_id = os.getenv("GOOGLE_CLIENT_ID")
        self.client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

    async def get_refresh_token(self, user_id: str) -> str:
        """
        Fetch the stored refresh token for a user from Supabase.
        """
        try:
            res = self.supabase.table("profiles").select("google_refresh_token").eq("id", user_id).execute()
            if res.data and res.data[0].get("google_refresh_token"):
                return res.data[0]["google_refresh_token"]
        except Exception as e:
            logger.error(f"[SYNC] Failed to fetch refresh token for {user_id}: {str(e)}")
        return None

    async def refresh_access_token(self, refresh_token: str) -> str:
        """
        Exchange a refresh token for a new access token.
        """
        if not self.client_id or not self.client_secret:
            raise GooglePeopleServiceError("Google OAuth credentials not configured.")

        token_url = "https://oauth2.googleapis.com/token"
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(token_url, data=data)
            if response.status_code != 200:
                logger.error(f"[SYNC] Token refresh failed: {response.text}")
                raise GooglePeopleServiceError(f"Failed to refresh token: {response.text}")
            
            return response.json().get("access_token")

    async def sync_contacts(self, user_id: str, access_token: str = None) -> Dict[str, Any]:
        """
        Fetch connections from Google People API and upsert into Supabase.
        If access_token is not provided, tries to use a stored refresh token.
        """
        try:
            # Generate a stable UUID if user_id is not already one
            try:
                uuid.UUID(user_id)
                stable_user_id = user_id
            except (ValueError, AttributeError):
                stable_user_id = generate_stable_uuid(user_id)
                logger.info(f"[SYNC] Using stable UUID {stable_user_id} for {user_id}")

            # REQ-031: Handle token persistence
            if not access_token:
                refresh_token = await self.get_refresh_token(stable_user_id)
                if not refresh_token:
                    logger.error(f"[SYNC] No access token provided and no refresh token found for {stable_user_id}")
                    raise GooglePeopleServiceError("Authentication required: No valid tokens found.")
                
                logger.info(f"[SYNC] Refreshing access token for {stable_user_id}")
                access_token = await self.refresh_access_token(refresh_token)

            creds = Credentials(token=access_token)
            service = build('people', 'v1', credentials=creds)

            # REQ-031: Fetch comprehensive data for OSINT/Enrichment with full pagination
            connections = []
            page_token = None
            stats = {"created": 0, "updated": 0, "errors": 0}

            while True:
                results = service.people().connections().list(
                    resourceName='people/me',
                    pageSize=1000,
                    personFields='names,emailAddresses,phoneNumbers,organizations,photos,birthdays,biographies,urls,addresses,userDefined,locales',
                    pageToken=page_token
                ).execute()

                batch = results.get('connections', [])
                connections.extend(batch)
                
                logger.info(f"[SYNC] Fetched batch of {len(batch)} connections. Total so far: {len(connections)}")

                # Process batch immediately to avoid memory bloat
                for person in batch:
                    try:
                        contact_data = self._map_person_to_contact(person, stable_user_id)
                        if not contact_data['full_name'] or contact_data['full_name'] == "Unknown":
                            continue

                        # Upsert into Supabase
                        try:
                            self.supabase.table('contacts').upsert(
                                contact_data,
                                on_conflict='google_resource_name'
                            ).execute()
                            stats["updated"] += 1
                        except Exception as db_err:
                            logger.error(f"[SYNC] DB error for {contact_data['full_name']}: {db_err}")
                            stats["errors"] += 1
                    except Exception as e:
                        stats["errors"] += 1
                
                page_token = results.get('nextPageToken')
                if not page_token:
                    break

            logger.info(f"[SYNC] Finished. Total contacts processed: {len(connections)}, Stats: {stats}")
            return {
                "status": "success",
                "stats": stats,
                "total_found": len(connections)
            }

        except Exception as e:
            logger.error(f"Error syncing Google contacts: {str(e)}")
            raise e

    def _map_person_to_contact(self, person: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """
        Maps a Google People API 'Person' object to our Supabase schema.
        Includes advanced fields for OSINT/Enrichment.
        """
        resource_name = person.get('resourceName')
        names = person.get('names', [])
        emails = person.get('emailAddresses', [])
        phones = person.get('phoneNumbers', [])
        orgs = person.get('organizations', [])
        birthdays = person.get('birthdays', [])
        photos = person.get('photos', [])
        bios = person.get('biographies', [])
        urls = person.get('urls', [])
        addresses = person.get('addresses', [])

        primary_name_obj = names[0] if names else {}
        first_name = primary_name_obj.get('givenName', 'Unknown')
        last_name = primary_name_obj.get('familyName', '')
        
        # Extract birthdate
        birthdate = None
        if birthdays:
            bday = birthdays[0].get('date', {})
            year = bday.get('year')
            month = bday.get('month')
            day = bday.get('day')
            if month and day:
                birthdate = f"{year if year else '1900'}-{month:02d}-{day:02d}"

        # Extract contact details
        primary_email = next((e.get('value') for e in emails if e.get('metadata', {}).get('primary')), 
                            emails[0].get('value') if emails else None)
        
        primary_phone = next((p.get('value') for p in phones if p.get('metadata', {}).get('primary')), 
                            phones[0].get('value') if phones else None)
        
        primary_org = next((o.get('name') for o in orgs if o.get('metadata', {}).get('primary')), 
                          orgs[0].get('name') if orgs else None)

        # OSINT/Enrichment Extras
        bio_text = bios[0].get('value') if bios else None
        
        return {
            "user_id": user_id,
            "first_name": first_name,
            "last_name": last_name,
            "full_name": f"{first_name} {last_name}".strip(),
            "email": primary_email,
            "phone": primary_phone,
            "organization": primary_org,
            "birthdate": birthdate,
            "notes": bio_text, # Map Google Bio to our internal notes
            "photo_url": photos[0].get('url') if photos else None,
            "google_resource_name": resource_name,
            "last_synced": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "raw_data": person # Keep entire object for UI flexibility
        }

