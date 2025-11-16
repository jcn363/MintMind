/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fs from 'fs';
import * as path from 'path';

/**
 * Coverage gate test to ensure minimum coverage thresholds are met
 * This test runs as part of the CI pipeline to enforce code quality standards
 */
describe('Coverage Gates', () => {
	const COVERAGE_THRESHOLDS = {
		global: {
			branches: 80,
			functions: 80,
			lines: 80,
			statements: 80
		},
		'./src/vs/workbench/api/common/': {
			branches: 85,
			functions: 85,
			lines: 85,
			statements: 85
		}
	};

	const COVERAGE_FILE = path.join(process.cwd(), 'coverage', 'coverage-summary.json');

	beforeAll(() => {
		// Ensure coverage file exists
		if (!fs.existsSync(COVERAGE_FILE)) {
			throw new Error(`Coverage file not found: ${COVERAGE_FILE}. Run tests with coverage first.`);
		}
	});

	it('should meet global coverage thresholds', () => {
		const coverageData = JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf8'));
		const globalCoverage = coverageData.total;

		expect(globalCoverage.branches.pct).toBeGreaterThanOrEqual(COVERAGE_THRESHOLDS.global.branches);
		expect(globalCoverage.functions.pct).toBeGreaterThanOrEqual(COVERAGE_THRESHOLDS.global.functions);
		expect(globalCoverage.lines.pct).toBeGreaterThanOrEqual(COVERAGE_THRESHOLDS.global.lines);
		expect(globalCoverage.statements.pct).toBeGreaterThanOrEqual(COVERAGE_THRESHOLDS.global.statements);
	});

	it('should meet workbench API coverage thresholds', () => {
		const coverageData = JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf8'));

		// Find workbench API files in coverage data
		const workbenchApiFiles = Object.keys(coverageData).filter(file =>
			file.includes('src/vs/workbench/api/common/')
		);

		expect(workbenchApiFiles.length).toBeGreaterThan(0);

		// Calculate weighted average coverage for workbench API files
		let totalBranches = 0, totalFunctions = 0, totalLines = 0, totalStatements = 0;
		let totalCoveredBranches = 0, totalCoveredFunctions = 0, totalCoveredLines = 0, totalCoveredStatements = 0;

		workbenchApiFiles.forEach(file => {
			const fileCoverage = coverageData[file];
			totalBranches += fileCoverage.branches.total;
			totalFunctions += fileCoverage.functions.total;
			totalLines += fileCoverage.lines.total;
			totalStatements += fileCoverage.statements.total;

			totalCoveredBranches += fileCoverage.branches.covered;
			totalCoveredFunctions += fileCoverage.functions.covered;
			totalCoveredLines += fileCoverage.lines.covered;
			totalCoveredStatements += fileCoverage.statements.covered;
		});

		const avgBranchCoverage = totalBranches > 0 ? (totalCoveredBranches / totalBranches) * 100 : 100;
		const avgFunctionCoverage = totalFunctions > 0 ? (totalCoveredFunctions / totalFunctions) * 100 : 100;
		const avgLineCoverage = totalLines > 0 ? (totalCoveredLines / totalLines) * 100 : 100;
		const avgStatementCoverage = totalStatements > 0 ? (totalCoveredStatements / totalStatements) * 100 : 100;

		expect(avgBranchCoverage).toBeGreaterThanOrEqual(COVERAGE_THRESHOLDS['./src/vs/workbench/api/common/'].branches);
		expect(avgFunctionCoverage).toBeGreaterThanOrEqual(COVERAGE_THRESHOLDS['./src/vs/workbench/api/common/'].functions);
		expect(avgLineCoverage).toBeGreaterThanOrEqual(COVERAGE_THRESHOLDS['./src/vs/workbench/api/common/'].lines);
		expect(avgStatementCoverage).toBeGreaterThanOrEqual(COVERAGE_THRESHOLDS['./src/vs/workbench/api/common/'].statements);
	});

	it('should have coverage data for critical modules', () => {
		const coverageData = JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf8'));

		const criticalFiles = [
			'extHostConfiguration.ts',
			'extHostWorkspace.ts',
			'extHostExtensionService.ts'
		];

		criticalFiles.forEach(filename => {
			const filePath = Object.keys(coverageData).find(path => path.includes(filename));
			expect(filePath).toBeDefined();

			const coverage = coverageData[filePath!];
			expect(coverage).toBeDefined();
			expect(coverage.lines.pct).toBeGreaterThan(0);
			expect(coverage.functions.pct).toBeGreaterThan(0);
		});
	});

	it('should not have significantly decreased coverage from baseline', () => {
		const coverageData = JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf8'));
		const currentGlobalCoverage = coverageData.total;

		// This is a basic regression check - in a real scenario, you'd compare against
		// a stored baseline or use a coverage comparison tool
		const baselineCoverage = {
			branches: 75,
			functions: 75,
			lines: 75,
			statements: 75
		};

		// Allow for some tolerance in coverage (5% decrease max)
		expect(currentGlobalCoverage.branches.pct).toBeGreaterThanOrEqual(baselineCoverage.branches - 5);
		expect(currentGlobalCoverage.functions.pct).toBeGreaterThanOrEqual(baselineCoverage.functions - 5);
		expect(currentGlobalCoverage.lines.pct).toBeGreaterThanOrEqual(baselineCoverage.lines - 5);
		expect(currentGlobalCoverage.statements.pct).toBeGreaterThanOrEqual(baselineCoverage.statements - 5);
	});

	it('should have integration tests for critical paths', () => {
		const integrationTestFiles = [
			'extHostConfiguration.integration.test.ts',
			'extHostWorkspace.integration.test.ts'
		];

		integrationTestFiles.forEach(filename => {
			const filePath = path.join(process.cwd(), 'src', 'vs', 'workbench', 'test', 'browser', '__tests__', filename);
			expect(fs.existsSync(filePath)).toBe(true);

			// Check that file has meaningful content
			const content = fs.readFileSync(filePath, 'utf8');
			expect(content.length).toBeGreaterThan(1000); // Basic size check
			expect(content).toContain('describe(');
			expect(content).toContain('it(');
		});
	});

	it('should validate test file organization', () => {
		const testDir = path.join(process.cwd(), 'src', 'vs', 'workbench', 'test', 'browser', '__tests__');
		const testFiles = fs.readdirSync(testDir).filter(file => file.endsWith('.test.ts'));

		expect(testFiles.length).toBeGreaterThanOrEqual(5); // Minimum test files

		testFiles.forEach(file => {
			const content = fs.readFileSync(path.join(testDir, file), 'utf8');

			// Check for proper Jest structure
			expect(content).toContain('describe(');
			expect(content).toContain('it(');
			expect(content).toContain('expect(');

			// Check for proper imports
			expect(content).toContain('import');

			// Check for JSDoc comments on complex tests
			if (content.includes('beforeEach') || content.includes('afterEach')) {
				expect(content).toMatch(/\/\*\*/);
			}
		});
	});
});