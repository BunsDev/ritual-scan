// Quick test script to verify smart cache is working
// Run in browser console after visiting the site for 30+ seconds

console.log('Testing Smart Cache...');

// Get the WebSocket manager
const manager = window.__NEXT_PRIVATE_RTM || 
  (window.realtimeManager || 
  (() => {
    console.error('Could not find realtime manager');
    return null;
  })());

if (manager) {
  console.log('✅ Found realtime manager');
  
  // Test cache methods
  try {
    const blocks = manager.getCachedBlocks();
    const scheduled = manager.getCachedScheduledTxs();
    const mempool = manager.getCachedMempoolStats();
    
    console.log(`📦 Cached blocks: ${blocks?.length || 0}`);
    console.log(`📦 Cached scheduled: ${scheduled?.length || 0}`);
    console.log(`📦 Cached mempool:`, mempool);
    
    if (blocks?.length > 0) {
      console.log('✅ SMART CACHE IS WORKING!');
      console.log('Latest block:', blocks[0]);
    } else {
      console.log('❌ Cache is empty - wait longer or check WebSocket connection');
    }
    
  } catch (error) {
    console.error('❌ Error accessing cache:', error);
  }
} else {
  console.log('❌ Realtime manager not found');
}
