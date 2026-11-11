describe('Organization menu navigation', () => {
  it('shows protected destinations on click without a document reload', () => {
    cy.viewport(1280, 1000);
    let loads = 0;
    cy.on('window:before:load', () => { loads++; });
    // Network-only stubs: real Ionic routes and access gates, no production auth bypass.
    for (const url of ['**/src/Firebase/config.ts*', '**/node_modules/.vite/deps/firebase_auth.js*', '**/node_modules/.vite/deps/firebase_firestore.js*']) {
      cy.intercept('GET', url, { fixture: 'organization-firebase.txt', headers: { 'content-type': 'application/javascript' } });
    }
    cy.visit('/lgu-dashboard');
    cy.get('button[aria-label="Open Manage Scholarships"]', { timeout: 15000 }).scrollIntoView({ offset: { top: -120, left: 0 } }).should('be.visible');
    const menus = [
      ['Manage Scholarships', '/lgu-scholarships', '.ms-page'],
      ['Applications', '/lgu-applications', '.organization-applications-page'],
      ['Messages', '/lgu-messages', '.msg-page'],
    ];
    for (const [label, path, selector] of menus) {
      cy.get(`button[aria-label="Open ${label}"]`).scrollIntoView({ offset: { top: -120, left: 0 } }).click({ scrollBehavior: 'center' });
      cy.location('pathname').should('eq', path);
      cy.get(selector, { timeout: 10000 }).should('be.visible');
      cy.get('.global-back-button').click({ scrollBehavior: 'center' });
      cy.location('pathname').should('eq', '/lgu-dashboard');
      cy.get('button[aria-label="Open Manage Scholarships"]').scrollIntoView({ offset: { top: -120, left: 0 } }).should('be.visible');
    }
    cy.then(() => expect(loads).to.eq(1));
  });
});
