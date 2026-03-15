# OneDrive

Use `m365` for OneDrive work. Use `m365_schema` if an endpoint is unclear.

CRITICAL: Always execute reads immediately. When the user asks to list files, search files, or check their OneDrive, call the tool right away. Do not describe what you could do or ask if they want you to proceed.

## List files in root

```json
{
  "tool": "m365",
  "args": {
    "service": "onedrive",
    "resource": "me/drive/root/children",
    "method": "list",
    "params": {
      "$select": "name,size,lastModifiedDateTime,folder,file,webUrl"
    }
  }
}
```

When presenting results, distinguish folders from files:
- Folders: show name and child count if available
- Files: show name, size (human-readable), and last modified date

## List files in a specific folder

Use the folder's item ID with `/children` appended to the resource:

```json
{
  "tool": "m365",
  "args": {
    "service": "onedrive",
    "resource": "me/drive/items/FOLDER_ID/children",
    "method": "list",
    "params": {
      "$select": "name,size,lastModifiedDateTime,folder,file"
    }
  }
}
```

## Get file metadata

```json
{
  "tool": "m365",
  "args": {
    "service": "onedrive",
    "resource": "me/drive/items",
    "method": "get",
    "id": "ITEM_ID",
    "params": {
      "$select": "name,size,lastModifiedDateTime,webUrl,createdBy,lastModifiedBy,file,folder"
    }
  }
}
```

## Search for files

```json
{
  "tool": "m365",
  "args": {
    "service": "onedrive",
    "resource": "me/drive/root/search(q='report')",
    "method": "list",
    "params": {
      "$select": "name,size,webUrl,lastModifiedDateTime"
    }
  }
}
```

## Get OneDrive storage quota

```json
{
  "tool": "m365",
  "args": {
    "service": "onedrive",
    "resource": "me/drive",
    "method": "get",
    "params": {
      "$select": "quota"
    }
  }
}
```

## Delete a file

```json
{
  "tool": "m365",
  "args": {
    "service": "onedrive",
    "resource": "me/drive/items",
    "method": "delete",
    "id": "ITEM_ID"
  }
}
```

Key patterns:
- Files in root: `me/drive/root/children`
- File by ID: `me/drive/items/{id}`
- Folder contents: `me/drive/items/{id}/children`
- Search: `me/drive/root/search(q='query')`
- Storage info: `me/drive` with `$select=quota`
- All items have `@microsoft.graph.downloadUrl` for direct download

Approval rules:
- Reads and searches pass through — no approval needed
- Uploads, deletes, and moves require approval
