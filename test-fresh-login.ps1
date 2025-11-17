# PowerShell script to test fresh login and verify session persistence
# This script will create a user, login, and check MongoDB for passport data

$ErrorActionPreference = "Stop"

$API_URL = "http://127.0.0.1:3000/api"
$TEST_EMAIL = "test-$(Get-Date -Format 'yyyyMMddHHmmss')@test.com"
$TEST_PASSWORD = "testpassword123"

Write-Host "`n=== Fresh Login Session Test ===" -ForegroundColor Cyan
Write-Host "Test Email: $TEST_EMAIL" -ForegroundColor Cyan
Write-Host ""

try {
    # Step 1: Create test user
    Write-Host "Step 1: Creating test user..." -ForegroundColor Blue
    $signupBody = @{
        email = $TEST_EMAIL
        password = $TEST_PASSWORD
        firstName = "Test"
        lastName = "User"
    } | ConvertTo-Json
    
    $signupResponse = Invoke-WebRequest -Uri "$API_URL/auth/signup" `
        -Method POST `
        -Body $signupBody `
        -ContentType "application/json" `
        -UseBasicParsing `
        -TimeoutSec 10
    
    if ($signupResponse.StatusCode -eq 201 -or $signupResponse.StatusCode -eq 200) {
        Write-Host "✓ User created successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Signup failed: $($signupResponse.StatusCode)" -ForegroundColor Red
        exit 1
    }
    
    # Step 2: Login
    Write-Host "`nStep 2: Logging in..." -ForegroundColor Blue
    $loginBody = @{
        email = $TEST_EMAIL
        password = $TEST_PASSWORD
    } | ConvertTo-Json
    
    $loginResponse = Invoke-WebRequest -Uri "$API_URL/auth/login" `
        -Method POST `
        -Body $loginBody `
        -ContentType "application/json" `
        -UseBasicParsing `
        -SessionVariable session `
        -TimeoutSec 10
    
    $loginData = $loginResponse.Content | ConvertFrom-Json
    
    if ($loginResponse.StatusCode -eq 200 -and $loginData.success) {
        Write-Host "✓ Login successful" -ForegroundColor Green
        $sessionId = $loginData.sessionId
        Write-Host "  Session ID: $sessionId" -ForegroundColor Cyan
        
        # Check for cookie
        $cookie = $loginResponse.Headers['Set-Cookie']
        if ($cookie) {
            Write-Host "✓ Cookie received" -ForegroundColor Green
            Write-Host "  Cookie: $($cookie.Substring(0, [Math]::Min(60, $cookie.Length)))..." -ForegroundColor Cyan
        } else {
            Write-Host "⚠ No cookie in response" -ForegroundColor Yellow
        }
    } else {
        Write-Host "✗ Login failed: $($loginResponse.StatusCode)" -ForegroundColor Red
        Write-Host "  Response: $($loginResponse.Content)" -ForegroundColor Yellow
        exit 1
    }
    
    # Step 3: Wait for session to be saved
    Write-Host "`nStep 3: Waiting for session to be saved to MongoDB..." -ForegroundColor Blue
    Start-Sleep -Seconds 2
    
    # Step 4: Check MongoDB
    Write-Host "`nStep 4: Checking MongoDB for session..." -ForegroundColor Blue
    Write-Host "  (Run: node check-sessions-mongo.js to see detailed results)" -ForegroundColor Yellow
    
    # Step 5: Test session persistence with cookie
    Write-Host "`nStep 5: Testing session persistence with cookie..." -ForegroundColor Blue
    $statusResponse = Invoke-WebRequest -Uri "$API_URL/auth/status" `
        -Method GET `
        -WebSession $session `
        -UseBasicParsing
    
    $statusData = $statusResponse.Content | ConvertFrom-Json
    
    if ($statusResponse.StatusCode -eq 200) {
        if ($statusData.authenticated -and $statusData.user) {
            Write-Host "✓ Session is persistent! User authenticated:" -ForegroundColor Green
            Write-Host "  User: $($statusData.user.email)" -ForegroundColor Cyan
            Write-Host "  User ID: $($statusData.user._id)" -ForegroundColor Cyan
        } else {
            Write-Host "✗ Session not authenticated" -ForegroundColor Red
            Write-Host "  Response: $($statusResponse.Content)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "✗ Status check failed: $($statusResponse.StatusCode)" -ForegroundColor Red
    }
    
    Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
    Write-Host "`nTo verify session in MongoDB, run:" -ForegroundColor Yellow
    Write-Host "  cd Backend" -ForegroundColor Yellow
    Write-Host "  node check-sessions-mongo.js" -ForegroundColor Yellow
    Write-Host "`nLook for session ID: $sessionId" -ForegroundColor Cyan
    Write-Host ""
    
} catch {
    Write-Host "`n✗ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "  Response: $responseBody" -ForegroundColor Yellow
    }
    exit 1
}

