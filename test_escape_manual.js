// Manual test - run with: node test_escape_manual.js
import blessed from 'blessed';

const screen = blessed.screen({
  smartCSR: true,
  title: 'Test Escape Key - Press ESC then q to quit'
});

const box = blessed.box({
  parent: screen,
  top: 'center',
  left: 'center',
  width: '60%',
  height: '50%',
  content: '{center}Press ESC key to test...\n\nGlobal escape handler is registered\nPress q to quit{/center}',
  tags: true,
  border: {
    type: 'line'
  }
});

// Global escape handler (like in tui.js line 136)
screen.key(['escape'], () => {
  box.setContent('{center}{green-fg}✓ Global ESCAPE handler triggered!{/green-fg}\n\nPress q to quit{/center}');
  screen.render();
  console.log('Escape was pressed');
});

screen.key(['q', 'Q'], () => {
  console.log('Quitting...');
  process.exit(0);
});

screen.render();
console.log('Test started - press ESC to test, then q to quit');
