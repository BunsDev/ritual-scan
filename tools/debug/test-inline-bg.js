const puppeteer = require('puppeteer');

async function testInlineBackground() {
    console.log('🎨 TESTING INLINE WEBGL BACKGROUND IN RITUAL SCAN');
    console.log('=================================================\n');
    
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 800 });
        
        // Monitor console messages
        page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
        
        console.log('🌐 Loading Ritual Scan app...');
        await page.goto('http://localhost:5000', { 
            waitUntil: 'domcontentloaded',
            timeout: 15000 
        });
        
        // Wait for the page and WebGL to initialize
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check if the particle background canvas exists
        const canvasCheck = await page.evaluate(() => {
            const canvas = document.getElementById('particle-bg');
            if (!canvas) return { exists: false };
            
            const gl = canvas.getContext('webgl');
            return {
                exists: true,
                hasWebGL: !!gl,
                canvasSize: { w: canvas.width, h: canvas.height },
                position: canvas.style.position,
                zIndex: canvas.style.zIndex,
                opacity: canvas.style.opacity
            };
        });
        
        // Take screenshot
        await page.screenshot({ path: '/tmp/ritual-scan-with-bg.png' });
        console.log('📸 Screenshot saved: /tmp/ritual-scan-with-bg.png');
        
        // Page content check
        const pageContent = await page.evaluate(() => {
            return {
                title: document.title,
                h1Text: document.querySelector('h1')?.textContent,
                hasNavigation: !!document.querySelector('nav') || document.body.textContent.includes('Navigation'),
                bodyClasses: document.body.className
            };
        });
        
        console.log('\n📊 INLINE BACKGROUND TEST RESULTS:');
        console.log('==================================');
        
        console.log('🎨 Canvas Check:');
        console.log('  Canvas exists:', canvasCheck.exists ? '✅ Yes' : '❌ No');
        if (canvasCheck.exists) {
            console.log('  WebGL context:', canvasCheck.hasWebGL ? '✅ Active' : '❌ Failed');
            console.log('  Canvas size:', `${canvasCheck.canvasSize.w}x${canvasCheck.canvasSize.h}`);
            console.log('  Position:', canvasCheck.position);
            console.log('  Z-index:', canvasCheck.zIndex);
            console.log('  Opacity:', canvasCheck.opacity);
        }
        
        console.log('\n📄 Page Content:');
        console.log('  Title:', pageContent.title);
        console.log('  H1 Text:', pageContent.h1Text);
        console.log('  Has Navigation:', pageContent.hasNavigation ? '✅ Yes' : '❌ No');
        
        // Screenshot file check
        const fs = require('fs');
        if (fs.existsSync('/tmp/ritual-scan-with-bg.png')) {
            const size = fs.statSync('/tmp/ritual-scan-with-bg.png').size;
            console.log('\n📸 Screenshot:', `✅ ${size} bytes`);
        }
        
        // Final verdict
        const isWorking = canvasCheck.exists && 
                         canvasCheck.hasWebGL && 
                         canvasCheck.position === 'fixed' && 
                         canvasCheck.zIndex === '-10';
        
        console.log('\n🎯 FINAL VERDICT:');
        console.log('================');
        if (isWorking) {
            console.log('✅ INLINE WEBGL BACKGROUND IS WORKING!');
            console.log('🎨 Features Confirmed:');
            console.log('  - Canvas element created and positioned');
            console.log('  - WebGL context initialized');
            console.log('  - Proper z-index layering (behind content)');
            console.log('  - Fixed positioning and opacity set');
            console.log('\n🌐 App running at: http://localhost:5000');
        } else {
            console.log('❌ INLINE BACKGROUND ISSUES DETECTED');
            if (!canvasCheck.exists) console.log('  - Canvas element not found');
            if (!canvasCheck.hasWebGL) console.log('  - WebGL context failed');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await browser.close();
    }
}

testInlineBackground().catch(console.error);
