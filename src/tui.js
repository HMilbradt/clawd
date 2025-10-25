import blessed from 'blessed'

/**
 * Terminal UI manager for clawd
 * Provides a split-pane interface with scrollable logs and status bar
 */
export class TUI {
  constructor() {
    this.screen = null
    this.headerBox = null
    this.spinnerBox = null
    this.logBox = null
    this.statusBar = null
    this.commandBar = null
    this.promptCountBox = null
    this.loadingIndicator = null
    this.isInitialized = false
    this.isPaused = false
    this.cancelRequested = false
    this.spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    this.spinnerIndex = 0
    this.spinnerInterval = null
  }

  /**
   * Initialize the TUI
   */
  init() {
    if (this.isInitialized) return

    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Clawd - Claude Code Orchestrator',
      fullUnicode: true
    })

    // Header with title
    this.headerBox = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%-12',
      height: 3,
      content:
        '{center}{bold}{cyan-fg}CLAWD - Claude Code Orchestrator{/cyan-fg}{/bold}{/center}',
      tags: true,
      style: {
        fg: 'cyan',
        bg: 'black'
      },
      border: {
        type: 'line',
        fg: 'cyan'
      }
    })

    // Animated spinner box (top right)
    this.spinnerBox = blessed.box({
      parent: this.screen,
      top: 0,
      right: 0,
      width: 12,
      height: 3,
      content: '',
      tags: true,
      align: 'center',
      valign: 'middle',
      style: {
        fg: 'green',
        bg: 'black',
        bold: true
      },
      border: {
        type: 'line',
        fg: 'green'
      }
    })

    // Main log area (scrollable) - more whitespace with padding
    this.logBox = blessed.log({
      parent: this.screen,
      top: 4,
      left: 0,
      width: '100%',
      height: '100%-10',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: '█',
        inverse: true
      },
      mouse: true,
      keys: true,
      vi: true,
      padding: {
        left: 1,
        right: 1,
        top: 1,
        bottom: 1
      },
      style: {
        fg: 'white',
        bg: 'black',
        scrollbar: {
          bg: 'blue'
        }
      },
      border: {
        type: 'line'
      }
    })

    // Status bar at bottom (showing phase/iteration)
    this.statusBar = blessed.box({
      parent: this.screen,
      bottom: 3,
      left: 0,
      width: '100%-20',
      height: 3,
      content: '',
      tags: true,
      padding: {
        left: 1
      },
      style: {
        fg: 'white',
        bg: 'blue'
      },
      border: {
        type: 'line',
        fg: 'blue'
      }
    })

    // Prompt counter box (next to status bar)
    this.promptCountBox = blessed.box({
      parent: this.screen,
      bottom: 3,
      right: 0,
      width: 20,
      height: 3,
      content: '',
      tags: true,
      align: 'center',
      valign: 'middle',
      style: {
        fg: 'black',
        bg: 'yellow',
        bold: true
      },
      border: {
        type: 'line',
        fg: 'yellow'
      }
    })

    // Command bar at very bottom (different color)
    this.commandBar = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '',
      tags: true,
      padding: {
        left: 1
      },
      style: {
        fg: 'black',
        bg: 'magenta',
        bold: true
      },
      border: {
        type: 'line',
        fg: 'magenta'
      }
    })

    // Handle Ctrl+C
    this.screen.key(['C-c'], () => {
      this.destroy()
      process.exit(0)
    })

    // Handle mouse wheel scrolling
    this.logBox.on('wheeldown', () => {
      this.logBox.scroll(3)
      this.screen.render()
    })

    this.logBox.on('wheelup', () => {
      this.logBox.scroll(-3)
      this.screen.render()
    })

    // Start spinner animation
    this.startSpinner()

    this.isInitialized = true
    this.screen.render()
  }

  /**
   * Start the animated spinner
   */
  startSpinner() {
    this.spinnerInterval = setInterval(() => {
      const frame = this.spinnerFrames[this.spinnerIndex]
      this.spinnerBox.setContent(`{green-fg}{bold}${frame}{/bold}{/green-fg}`)
      this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length
      this.screen.render()
    }, 80)
  }

  /**
   * Stop the animated spinner
   */
  stopSpinner() {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval)
      this.spinnerInterval = null
    }
  }

  /**
   * Log a message to the scrollable log area
   * @param {string} message - The message to log
   * @param {string} level - Log level (info, warn, error, success)
   */
  log(message, level = 'info') {
    if (!this.isInitialized) {
      console.log(message)
      return
    }

    // Strip ANSI codes for blessed (we'll use blessed tags instead)
    const cleanMessage = this.stripAnsi(message)

    // Add color tags based on level
    let coloredMessage = cleanMessage
    switch (level) {
      case 'error':
        coloredMessage = `{red-fg}${cleanMessage}{/red-fg}`
        break
      case 'warn':
        coloredMessage = `{yellow-fg}${cleanMessage}{/yellow-fg}`
        break
      case 'success':
        coloredMessage = `{green-fg}${cleanMessage}{/green-fg}`
        break
      case 'info':
        coloredMessage = `{cyan-fg}${cleanMessage}{/cyan-fg}`
        break
      case 'debug':
        coloredMessage = `{gray-fg}${cleanMessage}{/gray-fg}`
        break
      default:
        coloredMessage = cleanMessage
    }

    this.logBox.log(coloredMessage)
    this.screen.render()
  }

  /**
   * Update the status bar and command bar
   * @param {Object} status - Status information
   */
  updateStatus(status) {
    if (!this.isInitialized) return

    const { phase, iteration, interactive } = status

    // Update status bar with phase and iteration
    let statusText = ''
    if (phase) {
      statusText += `{bold}Phase:{/bold} ${phase}`
    }
    if (iteration) {
      statusText += ` {bold}│{/bold} {bold}Iteration:{/bold} ${iteration}`
    }
    this.statusBar.setContent(statusText)

    // Update command bar with interactive commands
    if (interactive) {
      const commandText =
        '{bold}[p]{/bold} prompt  {bold}[SPACE]{/bold} pause  {bold}[ESC]{/bold} cancel  {bold}[?]{/bold} help  {bold}[Ctrl+C]{/bold} quit'
      this.commandBar.setContent(commandText)
    } else {
      this.commandBar.setContent('{bold}[Ctrl+C]{/bold} quit')
    }

    this.screen.render()
  }

  /**
   * Update the prompt counter
   * @param {number} count - Number of queued prompts
   */
  updatePromptCount(count) {
    if (!this.isInitialized) return

    if (count > 0) {
      this.promptCountBox.setContent(`{bold}📬 ${count} queued{/bold}`)
      this.promptCountBox.style.bg = 'yellow'
      this.promptCountBox.style.fg = 'black'
    } else {
      this.promptCountBox.setContent('{bold}No prompts{/bold}')
      this.promptCountBox.style.bg = 'green'
      this.promptCountBox.style.fg = 'black'
    }

    this.screen.render()
  }

  /**
   * Show a banner message
   * @param {string} message - Banner message
   * @param {string} style - Style (info, success, warning)
   */
  showBanner(message, style = 'info') {
    if (!this.isInitialized) {
      console.log(message)
      return
    }

    const border = '━'.repeat(60)
    let color = 'cyan'
    if (style === 'success') color = 'green'
    if (style === 'warning') color = 'yellow'

    this.log(`{${color}-fg}{bold}${border}{/bold}{/${color}-fg}`)
    this.log(`{${color}-fg}{bold}${message}{/bold}{/${color}-fg}`)
    this.log(`{${color}-fg}{bold}${border}{/bold}{/${color}-fg}`)
  }

  /**
   * Write raw output (for child process stdout/stderr)
   * @param {string} data - Raw data to write
   */
  writeOutput(data) {
    if (!this.isInitialized) {
      process.stdout.write(data)
      return
    }

    // Split by lines and log each
    const lines = data.toString().split('\n')
    lines.forEach((line) => {
      if (line.trim()) {
        this.log(line)
      }
    })
  }

  /**
   * Strip ANSI color codes from a string
   * @param {string} str - String with ANSI codes
   * @returns {string} - Clean string
   */
  stripAnsi(str) {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, '')
  }

  /**
   * Get the blessed screen for custom key bindings
   * @returns {Object} - Blessed screen
   */
  getScreen() {
    return this.screen
  }

  /**
   * Show a prompt using blessed's built-in prompt
   * @param {string} message - The prompt message
   * @returns {Promise<string>} - The user's input
   */
  async prompt(message) {
    if (!this.isInitialized) return ''

    return new Promise((resolve) => {
      // Create a prompt box
      const promptBox = blessed.prompt({
        parent: this.screen,
        border: 'line',
        height: 'shrink',
        width: 'half',
        top: 'center',
        left: 'center',
        label: ' {blue-fg}Prompt{/blue-fg} ',
        tags: true,
        keys: true,
        vi: true
      })

      promptBox.input(message, '', (err, value) => {
        resolve(value || '')
      })

      this.screen.render()
    })
  }

  /**
   * Show a list selection using blessed
   * @param {string} message - The prompt message
   * @param {Array} choices - Array of choice objects {name, value}
   * @returns {Promise<string>} - The selected value
   */
  async select(message, choices) {
    if (!this.isInitialized) return ''

    return new Promise((resolve) => {
      // Create a list box
      const list = blessed.list({
        parent: this.screen,
        label: ` {blue-fg}${message}{/blue-fg} `,
        tags: true,
        border: 'line',
        width: '60%',
        height: '50%',
        top: 'center',
        left: 'center',
        keys: true,
        vi: true,
        mouse: true,
        style: {
          selected: {
            bg: 'blue',
            fg: 'white',
            bold: true
          },
          border: {
            fg: 'blue'
          }
        }
      })

      // Add choices to list
      const items = choices.map((c) => c.name)
      list.setItems(items)

      // Handle selection
      list.on('select', (item, index) => {
        const selectedValue = choices[index].value
        list.detach()
        this.screen.render()
        resolve(selectedValue)
      })

      // Handle cancel
      list.key(['escape', 'q'], () => {
        list.detach()
        this.screen.render()
        resolve('cancel')
      })

      this.screen.append(list)
      list.focus()
      this.screen.render()
    })
  }

  /**
   * Show a loading indicator
   * @param {string} message - Loading message
   */
  showLoadingIndicator(message = 'Loading') {
    if (!this.isInitialized) return

    if (this.loadingIndicator) {
      this.loadingIndicator.destroy()
    }

    this.loadingIndicator = blessed.loading({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '50%',
      height: 5,
      border: 'line',
      label: ' {blue-fg}Please Wait{/blue-fg} ',
      tags: true,
      style: {
        border: {
          fg: 'blue'
        }
      }
    })

    this.loadingIndicator.load(message)
    this.screen.render()
  }

  /**
   * Show rate limit waiting indicator with countdown
   * @param {number} waitTimeMs - Total wait time in milliseconds
   * @param {string} resetTime - Reset time string (e.g., "10pm")
   * @returns {Object} - Object with update() and hide() methods
   */
  showRateLimitWaiting(waitTimeMs, resetTime) {
    if (!this.isInitialized) {
      console.log(`⏳ Rate limited - waiting ${Math.ceil(waitTimeMs / 60000)} minutes...`)
      return { update: () => {}, hide: () => {} }
    }

    // Hide loading indicator if present
    if (this.loadingIndicator) {
      this.loadingIndicator.destroy()
      this.loadingIndicator = null
    }

    // Create waiting box
    const waitBox = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '70%',
      height: 9,
      border: 'line',
      label: ' {yellow-fg}⏳ Rate Limit{/yellow-fg} ',
      tags: true,
      padding: {
        left: 2,
        right: 2,
        top: 1,
        bottom: 1
      },
      style: {
        border: {
          fg: 'yellow'
        }
      }
    })

    const startTime = Date.now()
    const endTime = startTime + waitTimeMs

    // Update function to refresh the countdown
    const update = () => {
      const now = Date.now()
      const remaining = Math.max(0, endTime - now)
      const remainingMinutes = Math.ceil(remaining / 60000)

      const resetInfo = resetTime ? `Resets at: {bold}${resetTime}{/bold}` : ''

      const content = [
        '{yellow-fg}Session limit reached{/yellow-fg}',
        '',
        `Time remaining: {bold}{green-fg}${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}{/green-fg}{/bold}`,
        resetInfo,
        '',
        '{gray-fg}Clawd will automatically retry when the limit resets{/gray-fg}'
      ].filter(Boolean).join('\n')

      waitBox.setContent(content)
      this.screen.render()

      return remaining > 0
    }

    // Initial update
    update()

    // Hide function
    const hide = () => {
      waitBox.destroy()
      this.screen.render()
    }

    return { update, hide }
  }

  /**
   * Hide the loading indicator
   */
  hideLoadingIndicator() {
    if (this.loadingIndicator) {
      this.loadingIndicator.stop()
      this.loadingIndicator.destroy()
      this.loadingIndicator = null
      this.screen.render()
    }
  }

  /**
   * Pause execution and show pause menu
   * @returns {Promise<string>} - User choice: 'continue', 'quit', or 'prompt'
   */
  async showPauseMenu() {
    if (!this.isInitialized) return 'continue'

    this.isPaused = true
    this.log('⏸️  Execution paused', 'warn')

    const choice = await this.select('What would you like to do?', [
      { name: 'Continue execution', value: 'continue' },
      { name: 'Queue a prompt', value: 'prompt' },
      { name: 'Quit', value: 'quit' }
    ])

    this.isPaused = false
    return choice
  }

  /**
   * Request cancellation of current task
   */
  requestCancel() {
    this.cancelRequested = true
  }

  /**
   * Check if cancellation was requested
   * @returns {boolean}
   */
  isCancelRequested() {
    return this.cancelRequested
  }

  /**
   * Clear cancel request
   */
  clearCancelRequest() {
    this.cancelRequested = false
  }

  /**
   * Check if paused
   * @returns {boolean}
   */
  isPausedState() {
    return this.isPaused
  }

  /**
   * Show confirmation dialog
   * @param {string} message - Confirmation message
   * @returns {Promise<boolean>} - True if confirmed
   */
  async confirm(message) {
    if (!this.isInitialized) return false

    const answer = await this.prompt(`${message} (type 'yes' to confirm)`)
    return answer && answer.toLowerCase() === 'yes'
  }

  /**
   * Destroy the TUI and restore terminal
   */
  destroy() {
    this.stopSpinner()
    if (this.loadingIndicator) {
      this.loadingIndicator.destroy()
    }
    if (this.screen) {
      this.screen.destroy()
    }
    this.isInitialized = false
  }

  /**
   * Render the screen
   */
  render() {
    if (this.screen) {
      this.screen.render()
    }
  }
}

// Singleton instance
let tuiInstance = null

/**
 * Get or create the TUI instance
 * @returns {TUI}
 */
export function getTUI() {
  if (!tuiInstance) {
    tuiInstance = new TUI()
  }
  return tuiInstance
}

/**
 * Initialize the global TUI
 */
export function initTUI() {
  const tui = getTUI()
  tui.init()
  return tui
}
