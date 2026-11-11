describe('Automatic production updates', () => {
  const origin = Cypress.env('PWA_URL') || 'http://localhost:8101';
  it('loads a new build automatically while preserving the current route', () => {
    let loaded = 0; let newer = false;
    cy.on('window:before:load', () => { loaded++; });
    cy.request(`${origin}/version.json`).then(response => {
      const currentVersion = response.body.version;
      cy.intercept('GET', '**/version.json*', request => request.reply({ version: newer && loaded < 2 ? 'next-production-build' : currentVersion })).as('version');
      cy.visit(`${origin}/lgu-login`);
      cy.get('form').should('be.visible'); cy.wait('@version');
      // Let the initial fetch consume its response before simulating a separate focus event.
      cy.wait(150);
      cy.then(() => { newer = true; });
      cy.window().then(window => window.dispatchEvent(new Event('focus')));
      cy.wait('@version');
      cy.get('form').should('be.visible');
      cy.wrap(null, { timeout: 15000 }).should(() => { expect(loaded).to.be.at.least(2); });
      cy.location('pathname').should('eq', '/lgu-login');
    });
  });
  it('defers automatic reload while a form contains unsaved input', () => {
    let loaded = 0; let newer = false;
    cy.on('window:before:load', () => { loaded++; });
    cy.request(`${origin}/version.json`).then(response => {
      const currentVersion = response.body.version;
      cy.intercept('GET', '**/version.json*', request => request.reply({ version: newer && loaded < 2 ? 'next-production-build' : currentVersion })).as('version');
      cy.visit(`${origin}/lgu-login`); cy.get('form').should('be.visible'); cy.wait('@version');
      cy.get('#lgu-login-email').find('input', { includeShadowDom: true }).type('draft@example.com');
      cy.then(() => { newer = true; });
      cy.window().then(window => window.dispatchEvent(new Event('focus'))); cy.wait('@version');
      cy.then(() => { expect(loaded).to.eq(1); });
      cy.get('#lgu-login-email').find('input', { includeShadowDom: true }).should('have.value', 'draft@example.com').clear();
      cy.contains('h1', 'LGU / School Login').click();
      cy.window().then(window => window.dispatchEvent(new Event('focus')));
      cy.wrap(null, { timeout: 15000 }).should(() => { expect(loaded).to.be.at.least(2); });
    });
  });
});
