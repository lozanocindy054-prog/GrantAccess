describe('Installable GrantAccess app', () => {
  const origin = Cypress.env('PWA_URL') || 'http://localhost:8101';
  it('uses GrantAccess branding and valid install icons', () => {
    cy.visit(`${origin}/register-choice`);
    cy.title().should('eq', 'GrantAccess');
    cy.get('.hero-brand img').should('have.attr', 'src', '/mylogo.png').and('be.visible');
    cy.contains('button', 'Install app').should('be.visible');
    cy.request(`${origin}/manifest.json`).then(response => {
      expect(response.body.name).to.eq('GrantAccess'); expect(response.body.display).to.eq('standalone'); expect(response.body.scope).to.eq('/');
      for (const size of [192, 512]) {
        const icon = response.body.icons.find((item: { sizes: string; purpose: string }) => item.sizes === `${size}x${size}` && item.purpose === 'any');
        expect(icon).not.to.eq(undefined);
        cy.window().then(window => new Cypress.Promise<void>((resolve, reject) => {
          const image = new window.Image();
          image.onload = () => { expect(image.naturalWidth).to.eq(size); expect(image.naturalHeight).to.eq(size); resolve(); };
          image.onerror = () => reject(new Error('Unable to load install icon'));
          image.src = `${origin}${icon.src}`;
        }));
      }
    });
  });
  it('activates an app-scoped service worker and prepares the offline page', () => {
    cy.visit(`${origin}/register-choice`);
    cy.window().then(window => window.navigator.serviceWorker.ready).then(registration => {
      expect(registration.scope).to.eq(`${origin}/`); expect(registration.active?.scriptURL).to.eq(`${origin}/sw.js`);
    });
    cy.window().then(async window => {
      const keys = await window.caches.keys();
      const name = keys.find(key => key.startsWith('grantaccess-static-'));
      expect(name).to.be.a('string');
      const cache = await window.caches.open(name!);
      const offline = await cache.match(`${origin}/offline.html`);
      expect(offline).not.to.eq(undefined); expect(await offline!.text()).to.include('You?re offline');
      expect(await cache.match(`${origin}/version.json`)).to.eq(undefined);
    });
  });
});
