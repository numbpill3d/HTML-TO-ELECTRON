// test/test-splitter.js
const HTMLElectronSplitter = require('../file-splitter');
const fs = require('fs').promises;
const path = require('path');

class TestSuite {
    constructor() {
        this.splitter = new HTMLElectronSplitter();
        this.testResults = [];
        this.cleanup = [];
    }

    async runAllTests() {
        console.log('🧪 Running HTML Electron Splitter Test Suite\n');

        try {
            await this.testBasicSplitting();
            await this.testWithOptions();
            await this.testErrorHandling();
            await this.testFileValidation();
            
            this.printResults();
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
        } finally {
            await this.cleanup();
        }
    }

    async testBasicSplitting() {
        console.log('📝 Test 1: Basic HTML Splitting');
        
        try {
            // Create test HTML file
            const testHTML = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { background: red; }
        .test { color: blue; }
    </style>
</head>
<body>
    <h1>Test</h1>
    <script>
        console.log('Hello World');
        function test() { return true; }
    </script>
</body>
</html>`;

            const testFile = 'test-input.html';
            await fs.writeFile(testFile, testHTML);
            this.cleanup.push(testFile);

            const result = await this.splitter.splitHTMLtoElectron(testFile, {
                outputDir: 'test-output-1'
            });

            this.cleanup.push('test-output-1');

            if (result.success) {
                // Verify files were created
                const cssExists = await this.fileExists('test-output-1/style.css');
                const jsExists = await this.fileExists('test-output-1/renderer.js');
                const htmlExists = await this.fileExists('test-output-1/index.html');
                const mainExists = await this.fileExists('test-output-1/main.js');
                const pkgExists = await this.fileExists('test-output-1/package.json');

                if (cssExists && jsExists && htmlExists && mainExists && pkgExists) {
                    this.testResults.push({ name: 'Basic Splitting', status: 'PASS' });
                    console.log('✅ Basic splitting test passed');
                } else {
                    this.testResults.push({ name: 'Basic Splitting', status: 'FAIL', reason: 'Missing files' });
                    console.log('❌ Basic splitting test failed - missing files');
                }
            } else {
                this.testResults.push({ name: 'Basic Splitting', status: 'FAIL', reason: result.error });
                console.log('❌ Basic splitting test failed:', result.error);
            }
        } catch (error) {
            this.testResults.push({ name: 'Basic Splitting', status: 'ERROR', reason: error.message });
            console.log('❌ Basic splitting test error:', error.message);
        }
    }

    async testWithOptions() {
        console.log('\n📝 Test 2: Splitting with Options');
        
        try {
            const testHTML = `
<!DOCTYPE html>
<html>
<head>
    <style>body { margin: 0; }</style>
    <script>alert('test');</script>
</head>
<body><h1>Test with Options</h1></body>
</html>`;

            const testFile = 'test-input-2.html';
            await fs.writeFile(testFile, testHTML);
            this.cleanup.push(testFile);

            const result = await this.splitter.splitHTMLtoElectron(testFile, {
                outputDir: 'test-output-2',
                createZip: true
            });

            this.cleanup.push('test-output-2');
            this.cleanup.push('test-output-2.zip');

            if (result.success && result.files.zipFile) {
                const zipExists = await this.fileExists('test-output-2.zip');
                if (zipExists) {
                    this.testResults.push({ name: 'Options Test', status: 'PASS' });
                    console.log('✅ Options test passed');
                } else {
                    this.testResults.push({ name: 'Options Test', status: 'FAIL', reason: 'Zip file not created' });
                    console.log('❌ Options test failed - zip not created');
                }
            } else {
                this.testResults.push({ name: 'Options Test', status: 'FAIL', reason: 'No zip file in result' });
                console.log('❌ Options test failed');
            }
        } catch (error) {
            this.testResults.push({ name: 'Options Test', status: 'ERROR', reason: error.message });
            console.log('❌ Options test error:', error.message);
        }
    }

    async testErrorHandling() {
        console.log('\n📝 Test 3: Error Handling');
        
        try {
            const result = await this.splitter.splitHTMLtoElectron('nonexistent.html');
            
            if (!result.success && result.error) {
                this.testResults.push({ name: 'Error Handling', status: 'PASS' });
                console.log('✅ Error handling test passed');
            } else {
                this.testResults.push({ name: 'Error Handling', status: 'FAIL', reason: 'Should have failed' });
                console.log('❌ Error handling test failed - should have failed');
            }
        } catch (error) {
            this.testResults.push({ name: 'Error Handling', status: 'ERROR', reason: error.message });
            console.log('❌ Error handling test error:', error.message);
        }
    }

    async testFileValidation() {
        console.log('\n📝 Test 4: File Validation');
        
        try {
            // Create a directory instead of a file
            await fs.mkdir('test-dir', { recursive: true });
            this.cleanup.push('test-dir');

            const result = await this.splitter.splitHTMLtoElectron('test-dir');
            
            if (!result.success) {
                this.testResults.push({ name: 'File Validation', status: 'PASS' });
                console.log('✅ File validation test passed');
            } else {
                this.testResults.push({ name: 'File Validation', status: 'FAIL', reason: 'Should reject directories' });
                console.log('❌ File validation test failed');
            }
        } catch (error) {
            this.testResults.push({ name: 'File Validation', status: 'ERROR', reason: error.message });
            console.log('❌ File validation test error:', error.message);
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    printResults() {
        console.log('\n📊 Test Results Summary:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        let passed = 0;
        let failed = 0;
        let errors = 0;

        this.testResults.forEach(test => {
            const status = test.status === 'PASS' ? '✅' : 
                          test.status === 'FAIL' ? '❌' : '⚠️';
            console.log(`${status} ${test.name}: ${test.status}`);
            if (test.reason) {
                console.log(`   Reason: ${test.reason}`);
            }

            if (test.status === 'PASS') passed++;
            else if (test.status === 'FAIL') failed++;
            else errors++;
        });

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Total: ${this.testResults.length} | Passed: ${passed} | Failed: ${failed} | Errors: ${errors}`);
        
        if (failed === 0 && errors === 0) {
            console.log('🎉 All tests passed!');
        } else {
            console.log('⚠️  Some tests failed or had errors');
        }
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up test files...');
        
        for (const item of this.cleanup) {
            try {
                const stats = await fs.stat(item);
                if (stats.isDirectory()) {
                    await fs.rmdir(item, { recursive: true });
                } else {
                    await fs.unlink(item);
                }
                console.log(`  Removed: ${item}`);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.log(`  Failed to remove: ${item} (${error.message})`);
                }
            }
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const testSuite = new TestSuite();
    testSuite.runAllTests();
}

module.exports = TestSuite;
