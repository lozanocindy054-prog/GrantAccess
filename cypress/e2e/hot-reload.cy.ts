describe('Development live reload', () => {
  it('reloads the open interface automatically when a React source file changes', () => {
    let loads = 0;
    cy.on('window:before:load', () => { loads++; });
    cy.visit('/lgu-login');
    cy.get('form').should('be.visible');
    cy.window().then(window => new Cypress.Promise<void>((resolve, reject) => {
      const deadline = Date.now() + 10000;
      const check = () => {
        const socket = window.performance.getEntriesByType('resource').some(entry => entry.name.includes('/@vite/client'));
        if (socket) resolve();
        else if (Date.now() > deadline) reject(new Error('Vite client was not loaded'));
        else window.setTimeout(check, 50);
      };
      check();
    }));
    // Let the Vite WebSocket finish its handshake before changing the watched file.
    cy.wait(500);
    cy.task('touchSourceForHotReload');
    cy.wrap(null, { timeout: 15000 }).should(() => { expect(loads).to.be.at.least(2); });
    cy.location('pathname').should('eq', '/lgu-login');
    cy.get('form').should('be.visible');
  });
  it('reloads organization changes even when the Vite WebSocket is unavailable', () => {
    let loads = 0;
    cy.on('window:before:load', () => { loads++; });
    cy.intercept('GET', '**/__grantaccess_dev_version*').as('devVersion');
    cy.visit('/lgu-login', { onBeforeLoad(window) {
      class DisconnectedWebSocket extends EventTarget {
        static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
        readyState = 0;
        send() {}
        close() { this.readyState = 3; }
      }
      window.WebSocket = DisconnectedWebSocket as unknown as typeof WebSocket;
    } });
    cy.get('form').should('be.visible');
    cy.wait('@devVersion'); cy.wait('@devVersion');
    cy.wait(150);
    cy.task('touchSourceForHotReload', 'organization');
    cy.wrap(null, { timeout: 15000 }).should(() => { expect(loads).to.be.at.least(2); });
    cy.location('pathname').should('eq', '/lgu-login');
    cy.get('form').should('be.visible');
  });
});
