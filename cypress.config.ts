import { defineConfig } from "cypress";
import { utimes } from "node:fs/promises";
import { resolve } from "node:path";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:8100",
    setupNodeEvents(on, config) {
      on('task', {
        async touchSourceForHotReload(target = 'login') {
          const files: Record<string, string> = {
            login: 'src/lgu & school/LoginLGUSchool/LoginLGUSchool.tsx',
            organization: 'src/lgu & school/LGUSchoolDashboard/LGUSchoolDashboard.tsx',
          };
          if (!files[target]) throw new Error('Unknown hot reload test target');
          const file = resolve(config.projectRoot, files[target]);
          const now = new Date();
          await utimes(file, now, now);
          return null;
        },
      });
    },
  },
});