describe('Administrator reports and tabs', () => {
  const mockAdmin = () => {
    for (const url of ['**/src/Firebase/config.ts*', '**/node_modules/.vite/deps/firebase_auth.js*', '**/node_modules/.vite/deps/firebase_firestore.js*']) {
      cy.intercept('GET', url, { fixture: 'admin-firebase.txt', headers: { 'content-type': 'application/javascript' } });
    }
  };
  it('navigates with admin tabs and downloads the filtered PDF report', () => {
    mockAdmin(); cy.viewport(1280, 1000); cy.visit('/admin-dashboard');
    cy.get('nav[aria-label="Admin tabs"]').contains('button', 'Reports').click({ scrollBehavior: 'center' });
    cy.location('pathname').should('eq', '/admin-reports');
    cy.contains('h1', 'Reports & Analytics').should('be.visible');
    cy.get('#report-tab-applications').click(); cy.get('#report-panel-applications').should('be.visible');
    cy.get('#report-panel-applications').should('contain', 'Ana Santos').and('contain', 'Ben Reyes');
    cy.get('input[placeholder="Student or scholarship..."]').type('Ana');
    cy.get('#report-panel-applications').should('contain', 'Ana Santos').and('not.contain', 'Ben Reyes');
    cy.contains('button', 'Generate PDF').click();
    cy.contains('strong', 'Your PDF report is ready', { timeout: 20000 }).should('be.visible');
    cy.get('.reports-download-ready a[download]').then(link => {
      const filename = link.attr('download')!; cy.wrap(link).click();
      cy.readFile(`cypress/downloads/${filename}`, 'binary', { timeout: 15000 }).should(contents => {
        expect({ validPdf: contents.startsWith('%PDF-'), includesAna: contents.includes('Ana Santos'), includesBen: contents.includes('Ben Reyes') }).to.deep.eq({ validPdf: true, includesAna: true, includesBen: false });
      });
    });
    cy.get('#report-tab-analytics').click({ scrollBehavior: 'center' }); cy.get('#report-panel-analytics').should('not.have.attr', 'hidden').contains('h2', 'Applications by Status').scrollIntoView({ offset: { top: -100, left: 0 } }).should('be.visible');
    cy.get('nav[aria-label="Admin tabs"]').contains('button', 'Students').click({ scrollBehavior: 'center' });
    cy.location('pathname').should('eq', '/admin-students'); cy.contains('h1', 'Registered Students').should('be.visible');
  });
  it('shows a dark green admin sign-in button with white text', () => {
    cy.visit('/admin-login');
    cy.get('.admin-login-submit').shadow().find('button').should('have.css', 'background-color', 'rgb(8, 118, 56)').and('have.css', 'color', 'rgb(255, 255, 255)');
  });
});
