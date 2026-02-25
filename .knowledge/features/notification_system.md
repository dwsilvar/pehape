# Notification System

## Overview

The application uses a **Snackbar-based notification system** powered by Material-UI to provide elegant, non-blocking user feedback. This system replaces native browser alerts and provides a consistent, modern user experience across the entire application.

## Purpose

Provide users with:
- **Success confirmations** for completed operations
- **Warning messages** for non-critical issues
- **Error notifications** for failed operations
- **Informational messages** for general updates

## Features

### Visual Design
- **Position**: Bottom-right corner of the screen
- **Color-coded**: 
  - 🟢 Green: Success
  - 🟠 Orange: Warning
  - 🔴 Red: Error
  - 🔵 Blue: Info
- **Auto-dismiss**: 6 seconds (configurable)
- **Manual dismiss**: X button on each notification
- **Non-blocking**: Doesn't interrupt user workflow
- **Stacking**: Multiple notifications queue properly

### Internationalization (i18n)
- Full support for multiple languages
- Uses `react-i18next` for translations
- Supports variable interpolation in messages
- Automatically updates when language changes

## Implementation

### Component Structure

The notification system is implemented using Material-UI components:
- `Snackbar`: Container for the notification
- `Alert`: Styled notification content with severity levels

### State Management

```typescript
const [snackbar, setSnackbar] = useState<{
  open: boolean;
  message: string;
  severity: 'success' | 'info' | 'warning' | 'error';
}>({ open: false, message: '', severity: 'info' });
```

### Basic Usage

```typescript
import { useState } from 'react';
import { Snackbar, Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation();
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });

  // Show notification
  const showNotification = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  // Close notification
  const handleClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <>
      {/* Your component content */}
      
      {/* Snackbar notification */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleClose}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};
```

## Usage Examples

### Success Notification

```typescript
// Simple success
setSnackbar({
  open: true,
  message: t('common.operation_success'),
  severity: 'success'
});

// Success with interpolation
setSnackbar({
  open: true,
  message: String(t('common.items_processed', { count: 5 })),
  severity: 'success'
});
```

### Warning Notification

```typescript
setSnackbar({
  open: true,
  message: String(t('common.operation_warning', { details: 'Some items were skipped' })),
  severity: 'warning'
});
```

### Error Notification

```typescript
try {
  // Some operation
} catch (e) {
  setSnackbar({
    open: true,
    message: e instanceof Error ? e.message : String(t('common.operation_error')),
    severity: 'error'
  });
}
```

### Info Notification

```typescript
setSnackbar({
  open: true,
  message: t('common.processing_started'),
  severity: 'info'
});
```

## Translation Keys

### Standard Keys (Recommended)

Add these keys to your translation files (`en.json`, `es.json`):

```json
{
  "common": {
    "operation_success": "Operation completed successfully!",
    "operation_error": "An error occurred",
    "operation_warning": "Operation completed with warnings: {{details}}",
    "processing_started": "Processing started...",
    "items_processed": "{{count}} item(s) processed successfully"
  }
}
```

### Component-Specific Keys

For specific features, create dedicated translation keys:

```json
{
  "common": {
    "rename_success": "Renamed successfully!",
    "rename_success_with_images": "Renamed successfully!\\n\\n{{count}} OCR image(s) were migrated.",
    "rename_error": "Error renaming resource",
    "upload_success": "File uploaded successfully!",
    "delete_success": "Item deleted successfully!",
    "save_success": "Changes saved successfully!"
  }
}
```

## Current Implementations

### FileExplorer - Rename Operations
**Location**: `frontend/src/components/FileExplorer.tsx`

**Notifications**:
- ✅ Success: File/folder renamed
- ✅ Success with images: Renamed + OCR images migrated
- ✅ Success with modules: Renamed + module references updated
- ✅ Success complete: Renamed + images + modules
- ⚠️ Warning: Renamed with migration warnings
- ❌ Error: Rename failed

**Translation Keys**:
- `common.rename_success`
- `common.rename_success_with_images`
- `common.rename_success_with_modules`
- `common.rename_success_complete`
- `common.rename_warning`
- `common.rename_error`

## Best Practices

### 1. Use Translations
Always use `t()` for messages to support internationalization:
```typescript
// ✅ Good
message: String(t('common.success'))

// ❌ Bad
message: 'Success!'
```

### 2. Convert to String
TypeScript requires explicit string conversion:
```typescript
message: String(t('common.success', { count: 5 }))
```

### 3. Severity Guidelines
- **Success**: Operation completed as expected
- **Info**: Informational messages, processing status
- **Warning**: Operation succeeded but with caveats
- **Error**: Operation failed

### 4. Message Length
- Keep messages concise (1-3 lines)
- Use line breaks (`\n`) for multi-line messages
- Avoid overly technical jargon

### 5. Auto-dismiss Duration
- Default: 6000ms (6 seconds)
- Short messages: 4000ms
- Important messages: 8000ms
- Critical errors: Consider longer or no auto-dismiss

## Configuration Options

### Custom Duration

```typescript
<Snackbar
  open={snackbar.open}
  autoHideDuration={8000}  // 8 seconds
  onClose={handleClose}
  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
>
```

### Custom Position

```typescript
// Top-right
anchorOrigin={{ vertical: 'top', horizontal: 'right' }}

// Bottom-center
anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}

// Top-left
anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
```

### No Auto-dismiss

```typescript
<Snackbar
  open={snackbar.open}
  autoHideDuration={null}  // Won't auto-dismiss
  onClose={handleClose}
  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
>
```

## Future Enhancements

- **Action buttons**: Add custom actions to notifications (e.g., "Undo", "View Details")
- **Progress indicators**: Show progress for long-running operations
- **Sound notifications**: Optional audio alerts for important events
- **Notification history**: View past notifications
- **Notification center**: Centralized notification management
- **Custom icons**: Component-specific icons for different notification types
- **Grouped notifications**: Combine similar notifications

## Migration Guide

### From Native Alerts

**Before**:
```typescript
alert('Operation successful!');
```

**After**:
```typescript
setSnackbar({
  open: true,
  message: t('common.operation_success'),
  severity: 'success'
});
```

### From Console Logs

**Before**:
```typescript
console.log('Processing started...');
```

**After**:
```typescript
setSnackbar({
  open: true,
  message: t('common.processing_started'),
  severity: 'info'
});
```

## Troubleshooting

### Notification Not Showing
1. Check `open` state is `true`
2. Verify Snackbar component is rendered
3. Check z-index conflicts with other components

### Translation Not Working
1. Ensure `useTranslation` is imported
2. Verify translation keys exist in locale files
3. Check `String()` conversion is applied

### Multiple Notifications Overlap
- Notifications automatically stack
- Consider debouncing rapid notifications
- Use a notification queue for better control

## Related Documentation

- [File Explorer Rename](./file_explorer_rename.md) - Rename feature using notifications
- [Material-UI Snackbar](https://mui.com/material-ui/react-snackbar/) - Official MUI documentation
- [react-i18next](https://react.i18next.com/) - Internationalization framework
