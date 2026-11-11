describe('Registration navigation', () => {
  it('redirects the root to account selection', () => {
    cy.visit('/')
    cy.location('pathname').should('eq', '/register-choice')
    cy.contains('Education opens doors.').should('be.visible')
  })

  it('opens student registration', () => {
    cy.visit('/register-choice')
    cy.contains('ion-button', 'Create Student Account').click()
    cy.location('pathname').should('eq', '/student-register')
    cy.contains('h2', 'Create Student Account').should('be.visible')
  })

  it('opens organization registration', () => {
    cy.visit('/register-choice')
    cy.contains('ion-button', 'Create LGU / School Account').click()
    cy.location('pathname').should('eq', '/lgu-register')
    cy.get('ion-page, .ion-page').should('exist')
  })

  it('opens student login', () => {
    cy.visit('/register-choice')
    cy.get('.student-text-login').click()
    cy.location('pathname').should('eq', '/login')
    cy.get('form').should('be.visible')
  })

  it('collects organization details without requesting a paid OTP function', () => {
    cy.intercept('POST', '**cloudfunctions.net/**', { statusCode: 500 }).as('legacyOtp')
    cy.visit('/lgu-register')
    cy.get('input[type="email"]').type('school@example.com')
    cy.contains('button', 'Continue').click()
    cy.get('input[placeholder="Create a password"]').type('Password123!')
    cy.get('input[placeholder="Re-enter your password"]').type('Password123!')
    cy.contains('button', 'Continue').click()
    cy.contains('strong', 'School').click()
    cy.get('input[placeholder="Enter official organization name"]').type('Test School')
    cy.get('input[placeholder="Street, barangay, municipality, province"]').type('Manila')
    cy.get('input[placeholder="e.g. 09123456789"]').type('09123456789')
    cy.contains('button', 'Continue').click()
    cy.contains('h3', 'Representative Information').should('be.visible')
    cy.get('@legacyOtp.all').should('have.length', 0)
  })


  it('requires admin sign-in for every protected admin page', () => {
    const paths = ['/admin-dashboard', '/admin-students', '/admin-organizations', '/admin-scholarships', '/admin-applications', '/admin-reports', '/admin-notifications', '/admin-activity-logs', '/admin-settings']
    paths.forEach(path => {
      cy.visit(path)
      cy.location('pathname').should('eq', '/admin-login')
      cy.get('form').should('be.visible')
    })
  })


  it('requires student login for protected student interfaces', () => {
    const paths = ['/student-dashboard', '/student-location', '/organization-profile/test', '/scholarships', '/application', '/application-history', '/saved', '/profile', '/student-messages', '/notifications']
    paths.forEach(path => { cy.visit(path); cy.location('pathname').should('eq', '/login'); cy.get('form').should('be.visible') })
  })

  it('requires organization login for protected organization interfaces', () => {
    const paths = ['/lgu-dashboard', '/lgu-school-profile', '/lgu-scholarships', '/lgu-applications', '/lgu-messages', '/lgu-settings', '/lgu-notifications', '/lgu-student-map']
    paths.forEach(path => { cy.visit(path); cy.location('pathname').should('eq', '/lgu-login'); cy.get('form').should('be.visible') })
  })

  it('keeps signed-out users out of stored files and verification screens', () => {
    ;['/files/test123', '/verify-email'].forEach(path => { cy.visit(path); cy.location('pathname').should('eq', '/register-choice') })
  })

  it('keeps the mobile back control above the page and returns to account choice', () => {
    cy.viewport(390, 844)
    cy.visit('/lgu-login')
    cy.get('form').should('be.visible')
    cy.get('.global-backbar').should('be.visible').then(bar => {
      cy.get('form').then(form => { expect(form[0].getBoundingClientRect().top).to.be.at.least(bar[0].getBoundingClientRect().bottom) })
    })
    cy.get('.global-back-button').should(button => { expect(button[0].getBoundingClientRect().height).to.be.at.least(44) })
    cy.screenshot('mobile-back-navigation')
    cy.get('.global-back-button').click()
    cy.location('pathname').should('eq', '/register-choice')
  })

  it('offers admin login without public admin registration', () => {
    cy.visit('/register-choice')
    cy.contains('Create Admin Account').should('not.exist')
    cy.contains('ion-button', 'Log in as Admin').click()
    cy.location('pathname').should('eq', '/admin-login')
    cy.get('form').should('be.visible')
    cy.contains('Create Account').should('not.exist')
    cy.visit('/admin-register')
    cy.location('pathname').should('eq', '/admin-login')
  })

})
