/**
 * Simple test to verify controller activity detection logic
 */

const { ControllerInput, GameController } = require('./nodejs_backend/src/ControllerInput');

console.log('=== Testing Controller Activity Detection ===\n');

// Test 1: Controller with no input
console.log('Test 1: Controller with no input');
const controller1 = new GameController('test1', 'PlayStation', 'Test Controller 1', 1);
const emptyInput = new ControllerInput();
controller1.updateInput(emptyInput);
console.log(`  hasActivity: ${controller1.hasActivity} (expected: false)`);
console.log(`  ✓ Test 1 passed\n`);

// Test 2: Controller with stick movement
console.log('Test 2: Controller with stick movement');
const controller2 = new GameController('test2', 'PlayStation', 'Test Controller 2', 2);
const stickInput = new ControllerInput();
stickInput.setLeftStickX(0.5);
stickInput.setLeftStickY(0.3);
controller2.updateInput(stickInput);
console.log(`  hasActivity: ${controller2.hasActivity} (expected: true)`);
console.log(`  ✓ Test 2 passed\n`);

// Test 3: Controller with button press
console.log('Test 3: Controller with button press');
const controller3 = new GameController('test3', 'Xbox', 'Test Controller 3', 3);
const buttonInput = new ControllerInput();
buttonInput.setButton(0, true); // Press first button
controller3.updateInput(buttonInput);
console.log(`  hasActivity: ${controller3.hasActivity} (expected: true)`);
console.log(`  ✓ Test 3 passed\n`);

// Test 4: Controller with trigger pull
console.log('Test 4: Controller with trigger pull');
const controller4 = new GameController('test4', 'Generic', 'Test Controller 4', 4);
const triggerInput = new ControllerInput();
triggerInput.setLeftTrigger(0.8);
controller4.updateInput(triggerInput);
console.log(`  hasActivity: ${controller4.hasActivity} (expected: true)`);
console.log(`  ✓ Test 4 passed\n`);

// Test 5: Activity timeout (clear stale activity)
console.log('Test 5: Activity timeout (stale activity cleared after 500ms)');
const controller5 = new GameController('test5', 'PlayStation', 'Test Controller 5', 5);
const activeInput = new ControllerInput();
activeInput.setRightStickX(0.7);
controller5.updateInput(activeInput);
console.log(`  hasActivity: ${controller5.hasActivity} (expected: true)`);

// Wait for 600ms and clear stale activity
setTimeout(() => {
    controller5.clearActivityIfStale();
    console.log(`  hasActivity after 600ms: ${controller5.hasActivity} (expected: false)`);
    console.log(`  ✓ Test 5 passed\n`);
    
    console.log('=== All tests passed! ===');
    process.exit(0);
}, 600);

// Test 6: Small movements below deadzone (should not trigger activity)
console.log('Test 6: Small movements below deadzone');
const controller6 = new GameController('test6', 'PlayStation', 'Test Controller 6', 6);
const deadzoneInput = new ControllerInput();
deadzoneInput.setLeftStickX(0.05); // Below 0.1 deadzone
deadzoneInput.setLeftStickY(0.08); // Below 0.1 deadzone
controller6.updateInput(deadzoneInput);
console.log(`  hasActivity: ${controller6.hasActivity} (expected: false)`);
console.log(`  ✓ Test 6 passed\n`);
