import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import RegisteredStudents from './AdminStudents/RegisteredStudents';
import LGUSchoolAccounts from './AdminOrganizations/LGUSchoolAccounts';
import AdminScholarships from './AdminScholarships/AdminScholarships';
import AdminApplications from './AdminApplications/AdminApplications';
const mocks = vi.hoisted(() => ({
  listeners: new Map<string, (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void>(),
}));
vi.mock('../Firebase/config', () => ({ db: {} }));
vi.mock('../services/adminService', () => ({ reviewApplicationAsAdmin: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ name }), getDocs: vi.fn(),
  onSnapshot: (ref: { name: string }, next: (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void) => { mocks.listeners.set(ref.name, next); return vi.fn(); },
}));
beforeEach(() => mocks.listeners.clear());
const publish = async (collection: string, data: Record<string, unknown>) => act(async () => {
  mocks.listeners.get(collection)!({ docs: [{ id: 'record1', data: () => data }] });
});
it('updates student accounts without a page reload', async () => {
  render(<MemoryRouter><RegisteredStudents /></MemoryRouter>);
  await publish('students', { fullName: 'Student One', email: 'one@example.com' }); expect(await screen.findByText('Student One')).toBeTruthy();
  await publish('students', { fullName: 'Student Two', email: 'two@example.com' }); expect(await screen.findByText('Student Two')).toBeTruthy(); expect(screen.queryByText('Student One')).toBeNull();
});
it('updates organizations without a page reload', async () => {
  render(<MemoryRouter><LGUSchoolAccounts /></MemoryRouter>);
  await publish('organizations', { organizationName: 'School One' }); expect(await screen.findByText('School One')).toBeTruthy();
  await publish('organizations', { organizationName: 'School Two' }); expect(await screen.findByText('School Two')).toBeTruthy();
});
it('updates scholarship listings without a page reload', async () => {
  render(<MemoryRouter><AdminScholarships /></MemoryRouter>);
  await publish('scholarships', { title: 'Scholarship One' }); expect(await screen.findByText('Scholarship One')).toBeTruthy();
  await publish('scholarships', { title: 'Scholarship Two' }); expect(await screen.findByText('Scholarship Two')).toBeTruthy();
});
it('updates application records without a page reload', async () => {
  render(<MemoryRouter><AdminApplications /></MemoryRouter>);
  await publish('applications', { studentName: 'Applicant One', scholarshipTitle: 'Study grant' }); expect(await screen.findByText('Applicant One')).toBeTruthy();
  await publish('applications', { studentName: 'Applicant Two', scholarshipTitle: 'Study grant' }); expect(await screen.findByText('Applicant Two')).toBeTruthy();
});
