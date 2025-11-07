/**
 * Continuously send active controller input to trigger the glow effect
 */

const http = require('http');

function sendGamepadUpdate(controllerId, axes, buttons) {
    const postData = JSON.stringify({
        controllerId: controllerId,
        gamepadData: {
            id: `Simulated ${controllerId}`,
            index: 0,
            axes: axes,
            buttons: buttons.map(pressed => ({ pressed, value: pressed ? 1.0 : 0.0 })),
            timestamp: Date.now()
        }
    });

    const options = {
        hostname: 'localhost',
        port: 8080,
        path: '/api/controllers/gamepad-update',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve());
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function keepSendingInput() {
    console.log('Sending active controller input continuously for 10 seconds...');
    console.log('Check the UI - the controller should have a cyan glow effect!');
    
    let count = 0;
    const interval = setInterval(async () => {
        try {
            // Send active input with varying stick positions
            const x = Math.sin(count * 0.1) * 0.8;
            const y = Math.cos(count * 0.1) * 0.8;
            await sendGamepadUpdate('gamepad_0', [x, y, 0, 0], [false, false, false, false]);
            count++;
        } catch (error) {
            console.error('Error:', error.message);
        }
    }, 50); // Send at 20Hz like the polling rate

    // Stop after 10 seconds
    setTimeout(() => {
        clearInterval(interval);
        console.log('\nStopped sending input. Controller glow should fade after 500ms.');
        process.exit(0);
    }, 10000);
}

keepSendingInput();
