/**
 * Simulate controller input by calling the backend API
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
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`✓ Sent gamepad update for ${controllerId}`);
                    resolve();
                } else {
                    reject(new Error(`Failed: ${res.statusCode}`));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

function getControllers() {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:8080/api/controllers', (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                resolve(JSON.parse(data));
            });
        }).on('error', reject);
    });
}

async function runTest() {
    console.log('=== Simulating Controller Input ===\n');

    try {
        // Send initial gamepad state (no input)
        console.log('1. Sending idle controller state...');
        await sendGamepadUpdate('gamepad_0', [0, 0, 0, 0], [false, false, false, false]);
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check controller state
        let controllers = await getControllers();
        console.log(`   Controllers detected: ${controllers.length}`);
        if (controllers.length > 0) {
            console.log(`   Controller 0 hasActivity: ${controllers[0].hasActivity}\n`);
        }

        // Send active input (stick movement)
        console.log('2. Sending active stick movement...');
        await sendGamepadUpdate('gamepad_0', [0.5, 0.3, 0, 0], [false, false, false, false]);
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check if activity is detected
        controllers = await getControllers();
        if (controllers.length > 0) {
            console.log(`   Controller 0 hasActivity: ${controllers[0].hasActivity}`);
            if (controllers[0].hasActivity) {
                console.log('   ✓ Activity detected!\n');
            } else {
                console.log('   ✗ Activity NOT detected\n');
            }
        }

        // Send button press
        console.log('3. Sending button press...');
        await sendGamepadUpdate('gamepad_0', [0, 0, 0, 0], [true, false, false, false]);
        await new Promise(resolve => setTimeout(resolve, 100));

        controllers = await getControllers();
        if (controllers.length > 0) {
            console.log(`   Controller 0 hasActivity: ${controllers[0].hasActivity}`);
            if (controllers[0].hasActivity) {
                console.log('   ✓ Button press detected!\n');
            }
        }

        // Wait for timeout (600ms)
        console.log('4. Waiting 600ms for activity timeout...');
        await new Promise(resolve => setTimeout(resolve, 600));

        controllers = await getControllers();
        if (controllers.length > 0) {
            console.log(`   Controller 0 hasActivity: ${controllers[0].hasActivity}`);
            if (!controllers[0].hasActivity) {
                console.log('   ✓ Activity timeout working!\n');
            } else {
                console.log('   ✗ Activity still active after timeout\n');
            }
        }

        console.log('=== Test Complete ===');
        process.exit(0);

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

runTest();
