# Mertis File Attachments - Complete Integration Guide

This guide walks you through adding drag-and-drop file attachments to Mertis with hybrid storage support (S3, SharePoint, Local).

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  BugForm    │    │  BugDetail  │    │  FileUpload │         │
│  │  (create)   │    │  (view)     │    │  Component  │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│        │                  │                   │                 │
│        └──────────────────┼───────────────────┘                 │
│                           │                                     │
│                    ┌──────▼──────┐                              │
│                    │   Axios     │                              │
│                    │   /api/*    │                              │
│                    └──────┬──────┘                              │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│                    BACKEND│                                     │
│                    ┌──────▼──────┐                              │
│                    │ attachments │                              │
│                    │   route     │                              │
│                    └──────┬──────┘                              │
│                           │                                     │
│              ┌────────────┼────────────┐                        │
│              │            │            │                        │
│        ┌─────▼─────┐ ┌────▼────┐ ┌────▼────┐                   │
│        │   Bug     │ │ Hybrid  │ │ Activity│                   │
│        │  Storage  │ │ Storage │ │   Log   │                   │
│        │(metadata) │ │ (files) │ │         │                   │
│        └───────────┘ └────┬────┘ └─────────┘                   │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│                  STORAGE  │ PROVIDERS                           │
│              ┌────────────┼────────────┐                        │
│              │            │            │                        │
│        ┌─────▼─────┐ ┌────▼────┐ ┌────▼────┐                   │
│        │  AWS S3   │ │SharePt  │ │  Local  │                   │
│        │  Bucket   │ │  Site   │ │  Disk   │                   │
│        └───────────┘ └─────────┘ └─────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

## Step-by-Step Integration

---

### STEP 1: Copy the Hybrid Storage Module

```bash
# SSH into your EC2
ssh -i your-key.pem ec2-user@your-server.example.com

# Copy module to mertis
cd /var/www/html/mertis
mkdir -p hybrid-storage
# Upload or copy the hybrid-storage folder here

# Install dependencies
cd hybrid-storage
npm install
cd ..
```

Your folder structure should be:
```
/var/www/html/mertis/
├── client/
├── server/
├── hybrid-storage/        ← NEW
│   ├── src/
│   │   ├── core/
│   │   ├── providers/
│   │   ├── routes/
│   │   └── index.js
│   └── package.json
└── package.json
```

---

### STEP 2: Add Attachments Column to Database

```bash
mysql -u mertis -p mertis
```

```sql
-- Add attachments column
ALTER TABLE bugs ADD COLUMN attachments TEXT NULL;

-- Verify
DESCRIBE bugs;

EXIT;
```

---

### STEP 3: Install Backend Dependencies

```bash
cd /var/www/html/mertis
npm install multer uuid --save
```

---

### STEP 4: Create Attachments Route

```bash
nano /var/www/html/mertis/server/routes/attachments.js
```

Copy the contents of `/home/claude/mertis-backend/attachments.js` into this file.

---

### STEP 5: Register Route in Server

```bash
nano /var/www/html/mertis/server/index.js
```

Add these lines:

```javascript
// Near the top with other imports
const attachmentsRouter = require('./routes/attachments');

// After other app.use() statements
app.use('/api/attachments', attachmentsRouter);

// Serve local uploads
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
```

---

### STEP 6: Update Environment Variables

```bash
nano /var/www/html/mertis/.env
```

Add:

```env
# ===========================================
# Storage Configuration
# ===========================================

# Default storage provider: 'local', 's3', or 'sharepoint'
DEFAULT_STORAGE=local

# AWS S3 (uncomment to enable)
# S3_BUCKET=mertis-attachments-example
# AWS_REGION=us-east-2
# AWS_ACCESS_KEY_ID=your-access-key        # Not needed if using IAM role
# AWS_SECRET_ACCESS_KEY=your-secret-key    # Not needed if using IAM role

# SharePoint (uncomment to enable)
# AZURE_CLIENT_ID=your-client-id
# AZURE_CLIENT_SECRET=your-client-secret
# AZURE_TENANT_ID=your-tenant-id
# SHAREPOINT_DOMAIN=company.sharepoint.com
# SHAREPOINT_SITE=Mertis
```

---

### STEP 7: Create Uploads Directory

```bash
mkdir -p /var/www/html/mertis/uploads
chmod 755 /var/www/html/mertis/uploads
```

---

### STEP 8: Copy Frontend Components

```bash
# Copy component files to client
cp /path/to/FileUpload.js /var/www/html/mertis/client/src/components/
cp /path/to/AttachmentList.js /var/www/html/mertis/client/src/components/
```

---

### STEP 9: Add CSS Styles

```bash
nano /var/www/html/mertis/client/src/styles.css
```

Append the contents of `attachments.css` to your styles.css file.

---

### STEP 10: Update BugForm.js

```bash
nano /var/www/html/mertis/client/src/components/BugForm.js
```

**Add imports at top:**
```javascript
import FileUpload from './FileUpload';
```

**Add state:**
```javascript
const [attachments, setAttachments] = useState([]);
const [createdBugId, setCreatedBugId] = useState(bugId || null);
```

**Add handler:**
```javascript
const handleUploadComplete = (uploadedFiles) => {
  setAttachments(prev => [...prev, ...uploadedFiles]);
};
```

**In fetchBug (for edit mode), parse attachments:**
```javascript
// After setting formData
const existingAttachments = bug.attachments ? 
  (typeof bug.attachments === 'string' ? JSON.parse(bug.attachments) : bug.attachments) : [];
setAttachments(existingAttachments);
setCreatedBugId(bugId);
```

**Add JSX section before form actions:**
```jsx
{/* File Upload Section */}
<div className="form-group">
  <label>File Attachments</label>
  <FileUpload
    bugId={createdBugId}
    onUploadComplete={handleUploadComplete}
    existingAttachments={attachments}
    disabled={!isEdit && !createdBugId}
  />
  {!isEdit && !createdBugId && (
    <p className="form-hint">
      💡 Save the bug first, then you can attach files.
    </p>
  )}
</div>
```

---

### STEP 11: Update BugDetail.js

```bash
nano /var/www/html/mertis/client/src/components/BugDetail.js
```

**Add imports:**
```javascript
import AttachmentList from './AttachmentList';
import FileUpload from './FileUpload';
```

**Add state:**
```javascript
const [attachments, setAttachments] = useState([]);
```

**In fetchBug, parse attachments:**
```javascript
// After setBug(res.data)
const bugAttachments = res.data.attachments ? 
  (typeof res.data.attachments === 'string' ? JSON.parse(res.data.attachments) : res.data.attachments) : [];
setAttachments(bugAttachments);
```

**Add handlers:**
```javascript
const handleUploadComplete = (uploadedFiles) => {
  setAttachments(prev => [...prev, ...uploadedFiles]);
};

const handleDeleteAttachment = (deletedAttachment) => {
  setAttachments(prev => prev.filter(a => a.id !== deletedAttachment.id));
};
```

**Add JSX section after description:**
```jsx
{/* Attachments Section */}
<div className="detail-section attachments-section">
  <h3>
    📎 ATTACHMENTS
    {attachments.length > 0 && (
      <span className="count">{attachments.length}</span>
    )}
  </h3>
  
  <AttachmentList
    bugId={bug.bugId || bug.bug_id || bugId}
    attachments={attachments}
    onDelete={handleDeleteAttachment}
    canDelete={user?.role === 'admin' || user?.username === bug.reporter}
  />
  
  <div style={{ marginTop: '1rem' }}>
    <FileUpload
      bugId={bug.bugId || bug.bug_id || bugId}
      onUploadComplete={handleUploadComplete}
      disabled={false}
    />
  </div>
</div>
```

---

### STEP 12: Rebuild and Restart

```bash
# Rebuild frontend
cd /var/www/html/mertis/client
npm run build

# Restart backend
pm2 restart mertis
```

---

### STEP 13: Test the Integration

1. **Open browser**: http://your-server.example.com/mertis
2. **Login** as admin
3. **Edit an existing bug** (or create new and then edit)
4. **Drag & drop** a file onto the upload zone
5. **Click Upload** to save the file
6. **View the bug** to see attachments listed
7. **Click download** button to download
8. **Check Activity Log** for "Attached file" entry

---

## Enabling S3 Storage

### 1. Create S3 Bucket

```bash
aws s3 mb s3://mertis-attachments-example --region us-east-2
```

### 2. Create IAM Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::mertis-attachments-example",
        "arn:aws:s3:::mertis-attachments-example/*"
      ]
    }
  ]
}
```

### 3. Attach IAM Role to EC2

1. AWS Console → EC2 → Select Instance → Actions → Security → Modify IAM Role
2. Create/Select role with the above policy
3. Attach to instance

### 4. Update .env

```env
DEFAULT_STORAGE=s3
S3_BUCKET=mertis-attachments-example
AWS_REGION=us-east-2
```

### 5. Restart

```bash
pm2 restart mertis
```

---

## Enabling SharePoint Storage

### 1. Register Azure AD Application

1. Azure Portal → Azure Active Directory → App registrations → New
2. Name: Mertis
3. Add API permissions: `Sites.ReadWrite.All`, `Files.ReadWrite.All`
4. Create client secret
5. Note: Client ID, Tenant ID, Client Secret

### 2. Update .env

```env
DEFAULT_STORAGE=sharepoint
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=your-tenant-id
SHAREPOINT_DOMAIN=company.sharepoint.com
SHAREPOINT_SITE=Mertis
```

### 3. Restart

```bash
pm2 restart mertis
```

---

## Troubleshooting

### "Storage not configured" error
- Check if `hybrid-storage` folder exists
- Run `npm install` in hybrid-storage folder
- Check .env has valid configuration

### Files not uploading
- Check `/var/www/html/mertis/uploads` exists and is writable
- Check PM2 logs: `pm2 logs mertis`
- Verify multer is installed: `npm list multer`

### S3 permission denied
- Verify IAM role is attached to EC2
- Check bucket policy allows the role
- Test with AWS CLI: `aws s3 ls s3://your-bucket`

### Downloads not working
- Ensure presigned URLs are being generated
- Check browser console for errors
- Verify CORS if using S3 directly

---

## File Structure After Integration

```
/var/www/html/mertis/
├── client/
│   └── src/
│       └── components/
│           ├── FileUpload.js       ← NEW
│           ├── AttachmentList.js   ← NEW
│           ├── BugForm.js          ← UPDATED
│           ├── BugDetail.js        ← UPDATED
│           └── ...
├── server/
│   ├── routes/
│   │   ├── attachments.js          ← NEW
│   │   └── ...
│   └── index.js                    ← UPDATED
├── hybrid-storage/                 ← NEW MODULE
│   └── src/
│       ├── providers/
│       │   ├── S3Provider.js
│       │   ├── SharePointProvider.js
│       │   └── LocalProvider.js
│       └── ...
├── uploads/                        ← NEW (for local storage)
└── .env                            ← UPDATED
```

---

## Summary

You now have:
- ✅ Drag-and-drop file uploads
- ✅ Multiple storage backends (Local, S3, SharePoint)
- ✅ Attachment metadata stored with bugs
- ✅ Download with signed URLs
- ✅ Activity log integration
- ✅ Delete capability
- ✅ File type/size validation
