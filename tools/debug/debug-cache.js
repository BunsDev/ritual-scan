// Debug script to test smart cache
// Paste this in browser console on localhost:3005

console.log('🔍 Debug: Testing Smart Cache...');

// Test 1: Check if realtime manager exists
try {
  const { getRealtimeManager } = await import('/src/lib/realtime-websocket.ts');
  console.log('✅ Import works');
  
  const manager = getRealtimeManager();
  console.log('✅ Manager created:', manager);
  
  // Test 2: Check connection status
  const status = manager.getConnectionStatus();
  console.log('📊 Connection status:', status);
  
  // Test 3: Check cache contents
  const blocks = manager.getCachedBlocks();
  const scheduled = manager.getCachedScheduledTxs();
  const mempool = manager.getCachedMempoolStats();
  
  console.log(`📦 Cached blocks: ${blocks?.length || 0}`);
  console.log(`📦 Cached scheduled: ${scheduled?.length || 0}`);
  console.log(`📦 Cached mempool:`, mempool);
  
  if (blocks?.length > 0) {
    console.log('✅ SMART CACHE HAS DATA!');
    console.log('Latest cached block:', blocks[0]);
  } else {
    console.log('❌ Cache is empty');
    
    // Test 4: Check if WebSocket is connected
    if (status.isConnected) {
      console.log('🔗 WebSocket connected but cache empty - check polling');
    } else {
      console.log('❌ WebSocket not connected - that\'s the problem');
    }
  }
  
} catch (error) {
  console.error('❌ Error testing cache:', error);
}
