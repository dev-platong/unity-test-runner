import { core } from './core';
import { ResultsCheck } from './model';

export async function run() {
  const artifactPath = process.argv[2] || './results.xml';
  const failedTestCount = await ResultsCheck.createCheck(artifactPath);
  if (failedTestCount >= 1) {
    core.setFailed(`Test(s) Failed! Check '${'checkName'}' for details.`);
  }
}
