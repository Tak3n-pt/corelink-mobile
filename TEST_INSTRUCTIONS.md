# 📱 Test Instructions - Queue System

## Current Setup Status
- ✅ Desktop Simulator: Running on port 3001
- 🔴 Desktop State: OFFLINE (ready for testing)
- ✅ Cloud Server: Online and accessible
- 🔨 Android App: Building...

## Once App Launches

### Test 1: Invoice Processing with Desktop Offline

1. **Open the App**
   - Should see the main screen
   - Look for any network status indicators

2. **Upload/Scan an Invoice**
   - Tap "Scan Invoice" or "Upload Invoice" 
   - Select an invoice image from gallery or take a photo
   - Watch the progress messages carefully

3. **Expected Results**:
   ```
   Progress Messages:
   1. "🚀 Starting processing"
   2. "☁️ Processing invoice with cloud server" 
   3. "🔍 Analyzing invoice..."
   4. "📦 Queueing for desktop sync..."
   5. "✅ Processing complete"
   
   Final Alert:
   "📦 Invoice Processed & Queued"
   - Shows items found
   - Mentions desktop offline
   - Offers "View Queue" option
   ```

4. **Check Console Logs** (if in dev mode):
   ```
   Look for:
   - "🖥️ Desktop server: ❌ Offline/Unreachable"
   - "✅ Cloud server is reachable: healthy"
   - "📦 Queueing invoice for desktop sync..."
   - "✅ Invoice queued: {success: true}"
   ```

### Test 2: Auto-Sync When Desktop Comes Online

1. **Bring Desktop Online**:
   ```bash
   curl -X POST http://localhost:3001/test/go-online
   ```

2. **Watch the App**:
   - Should detect desktop within 5-10 seconds
   - May show sync notification
   - Queue should clear automatically

3. **Verify Desktop Received Invoice**:
   ```bash
   curl http://localhost:3001/test/status
   ```
   Should show received invoices

### Test 3: Quick Commands for Testing

```bash
# Check desktop status
curl http://localhost:3001/test/status

# Toggle desktop offline
curl -X POST http://localhost:3001/test/go-offline

# Toggle desktop online  
curl -X POST http://localhost:3001/test/go-online

# Clear invoice history (for retesting)
curl -X POST http://localhost:3001/test/clear
```

## What to Look For

### Success Indicators:
- ✅ Invoice processes even with desktop offline
- ✅ Clear "Queued" message appears
- ✅ Queue stats show pending items
- ✅ Auto-sync triggers when desktop returns
- ✅ No "Network request failed" errors

### Console Output to Monitor:
- Network state changes
- Desktop discovery attempts
- Queue operations
- Sync attempts

## Troubleshooting

### If "Network request failed" appears:
1. Check internet connection
2. Verify cloud server is accessible
3. May need to rebuild if network config wasn't applied

### If desktop not detected when online:
1. Ensure same WiFi network
2. Check firewall isn't blocking port 3001
3. Verify desktop simulator is still running

### If queue doesn't sync:
1. Check console for errors
2. Manually trigger from queue view
3. Verify desktop endpoints working

## Ready to Test!
Once the app launches, follow Test 1 above to verify the queue system works properly.