# 📋 Queue System Test Guide

## Prerequisites
1. Android app rebuilt with network fixes (`rebuild-android.bat`)
2. Desktop server running (for later sync test)
3. Test invoice image ready on device

## 🧪 Test Scenarios

### Test 1: Invoice Processing with Desktop Offline
**Goal**: Verify invoice processes through cloud and queues for desktop

#### Steps:
1. **Stop Desktop Server** (if running)
   - Close the desktop app or stop the server
   - Verify it's offline by checking the app shows "Desktop: Offline"

2. **Open Mobile App**
   - Launch the app
   - Look for network status indicators

3. **Scan/Upload Invoice**
   - Tap "Scan Invoice" or "Upload Invoice"
   - Select or capture an invoice image
   - Watch the progress messages

4. **Expected Results**:
   ```
   ✅ Processing Progress:
   - Step 1: "🚀 Starting processing"
   - Step 2: "☁️ Processing invoice with cloud server"
   - Step 3: "🔍 Analyzing invoice..."
   - Step 4: "📦 Queueing for desktop sync..."
   - Step 5: "✅ Processing complete"
   
   ✅ Alert Message:
   "📦 Invoice Processed & Queued"
   - Cloud: Updated ✅
   - Desktop: Queued for sync 📦
   ```

5. **Verify Queue Status**
   - Tap "View Queue" in the alert
   - Should show:
     - Pending: 1
     - Partial: 0
     - Failed: 0
     - Total: 1

### Test 2: Auto-Sync When Desktop Comes Online
**Goal**: Verify queued invoices sync automatically

#### Steps:
1. **Start Desktop Server**
   - Launch desktop app
   - Ensure it's running on same network

2. **Watch Mobile App**
   - App should detect desktop within 5-10 seconds
   - Look for sync activity in console/logs

3. **Expected Behavior**:
   ```
   ✅ Auto-Sync Process:
   - Network monitor detects desktop online
   - Queue manager starts processing
   - Invoice syncs to desktop
   - Queue clears automatically
   ```

4. **Verify Sync Success**
   - Check desktop app for new invoice
   - Check mobile queue status (should be empty)
   - Recent scans should show synced invoice

### Test 3: Multiple Invoices Queued
**Goal**: Test batch processing of queued items

#### Steps:
1. **Desktop Offline** - Stop desktop server
2. **Process 3-5 Invoices** - Upload multiple invoices
3. **Check Queue** - Should show all pending
4. **Start Desktop** - Bring desktop online
5. **Verify Batch Sync** - All should sync (5 at a time)

### Test 4: Duplicate Prevention
**Goal**: Verify same invoice can't be queued twice

#### Steps:
1. **Desktop Offline**
2. **Process Invoice Once** - Upload and queue
3. **Try Same Invoice Again** (within 30 seconds)
4. **Expected**: "⚠️ Duplicate Invoice" alert

### Test 5: Network Interruption Recovery
**Goal**: Test resilience to network issues

#### Steps:
1. **Start Processing Invoice**
2. **Turn Off WiFi** during processing
3. **Expected**: Error with option to retry
4. **Turn WiFi Back On**
5. **Retry** - Should complete successfully

## 📊 Console Logs to Watch

Open developer console to see detailed logs:

```javascript
// Good signs:
"🔍 Checking desktop server availability..."
"🖥️ Desktop server: ❌ Offline/Unreachable"
"✅ Cloud server is reachable: healthy"
"📦 Queueing invoice for desktop sync..."
"✅ Invoice queued: {success: true, ...}"

// Auto-sync logs:
"🌐 Network state changed: wifi connected"
"🖥️ Desktop server discovered at: http://..."
"🔄 Found 1 items to sync"
"✅ Successfully synced invoice"
```

## 🔍 Verification Checklist

### After Each Test:
- [ ] Invoice shows in Recent Scans
- [ ] Queue count is accurate
- [ ] No duplicate entries
- [ ] Desktop receives synced data (when online)
- [ ] Memory usage stable (no leaks)
- [ ] Network listeners active

### Queue Stats Check:
```javascript
// In console or via button:
enhancedQueueManager.getQueueStats()
// Should return:
{
  pending: 0,    // Items waiting to sync
  partial: 0,    // Partially synced
  completed: X,  // Successfully synced
  failed: 0,     // Failed attempts
  total: X       // Total processed
}
```

## 🛠️ Troubleshooting

### Issue: "Network request failed"
**Solution**: 
- Rebuild app with `rebuild-android.bat`
- Check internet connection
- Verify cloud server is accessible

### Issue: Desktop not detected
**Solution**:
- Ensure same WiFi network
- Check desktop server is running
- Port 3001 not blocked by firewall

### Issue: Queue not syncing
**Solution**:
- Check console for errors
- Manually trigger sync from queue view
- Verify desktop endpoints working

### Issue: Duplicate invoices
**Solution**:
- Wait 30+ seconds between submissions
- Check duplicate detection window setting

## 📱 Testing Commands

### From App UI:
- **View Queue**: Shows current queue status
- **Retry Now**: Manually trigger sync attempt
- **Recent Scans**: View processed invoices

### From Console (Dev Mode):
```javascript
// Check queue status
await enhancedQueueManager.getQueueStats()

// Manually trigger sync
await enhancedQueueManager.triggerSync(
  desktopServerUrl, 
  INVOICE_SERVER_URL
)

// Clear queue (testing only!)
await AsyncStorage.removeItem('@invoice_queue_v2')

// View network state
NetInfo.fetch().then(state => console.log(state))
```

## ✅ Success Criteria

The queue system is working if:
1. ✅ Invoices process via cloud when desktop offline
2. ✅ Items queue without errors
3. ✅ Auto-sync triggers when desktop returns
4. ✅ No duplicates within 30-second window
5. ✅ Batch processing handles multiple items
6. ✅ Network changes trigger sync attempts
7. ✅ Memory/resources properly cleaned up
8. ✅ User gets clear feedback at each step

## 📝 Test Results Log

| Test | Date | Result | Notes |
|------|------|--------|-------|
| Desktop Offline | | ⏳ | |
| Auto-Sync | | ⏳ | |
| Multiple Queue | | ⏳ | |
| Duplicate Check | | ⏳ | |
| Network Recovery | | ⏳ | |

---

**Remember**: The goal is seamless operation whether the store owner is in the shop (90% of time) or outside (10% of time)!