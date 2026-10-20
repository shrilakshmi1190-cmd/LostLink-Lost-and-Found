# LostLink: backend API test script (Windows PowerShell 5.1 compatible)
# Location: LostLink/tests/api-test.ps1
#
# SAFE: this script never deletes data, never touches the schema and never
# reruns seed.sql. It only uses the normal API. It creates ONE new item
# titled "ZZ TEST ..." (plus one with an image) and does all claim /
# status changes on those NEW test items, so your 12 seed items stay unchanged.
#
# The admin passcode is typed when the script starts (hidden) and is kept
# only in memory. It is never written to a file.

$base  = 'http://localhost:5000'
$today = Get-Date -Format 'yyyy-MM-dd'
$stamp = Get-Date -Format 'HHmmss'
$script:pass = 0
$script:fail = 0
$script:createdItemIds = @()

function Check($name, $condition, $detail = '') {
  if ($condition) {
    Write-Host ("  PASS  " + $name) -ForegroundColor Green
    $script:pass++
  } else {
    Write-Host ("  FAIL  " + $name + "  " + $detail) -ForegroundColor Red
    $script:fail++
  }
}

function Section($title) {
  Write-Host ''
  Write-Host ('== ' + $title) -ForegroundColor Cyan
}

# Sends a request and ALWAYS returns Status + parsed Json (even for 4xx/5xx).
function Invoke-Api {
  param(
    [string]$Method,
    [string]$Path,
    $Body = $null,
    [switch]$Admin,
    [string]$Passcode = $null
  )
  $headers = @{}
  if ($Admin) { $headers['x-admin-passcode'] = $script:Passcode }
  if ($Passcode) { $headers['x-admin-passcode'] = $Passcode }

  $params = @{
    Uri             = ($base + $Path)
    Method          = $Method
    Headers         = $headers
    UseBasicParsing = $true
  }
  if ($null -ne $Body) {
    $params['Body'] = ($Body | ConvertTo-Json -Depth 5)
    $params['ContentType'] = 'application/json'
  }

  $status = 0
  $text = ''
  try {
    $r = Invoke-WebRequest @params
    $status = [int]$r.StatusCode
    $text = $r.Content
  } catch {
    $resp = $_.Exception.Response
    if ($null -ne $resp) { $status = [int]$resp.StatusCode }
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
      $text = $_.ErrorDetails.Message
    } elseif ($null -ne $resp) {
      try {
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $text = $reader.ReadToEnd()
      } catch { $text = '' }
    } else {
      $text = $_.Exception.Message
    }
  }

  $json = $null
  try { $json = $text | ConvertFrom-Json } catch { }
  return [pscustomobject]@{ Status = $status; Json = $json; Text = $text }
}

# Uploads a file with real curl.exe (PowerShell's "curl" is a different thing).
function Invoke-Upload($fileName, $title) {
  $outFile = 'lostlink-upload-response.json'
  $code = & curl.exe -s -o $outFile -w "%{http_code}" `
    -F "type=found" `
    -F "title=$title" `
    -F "description=Created by api-test.ps1 with an image" `
    -F "category_id=7" `
    -F "location=Test location" `
    -F "date_occurred=$today" `
    -F "reporter_name=Test Reporter" `
    -F "reporter_email=test.reporter@example.com" `
    -F "image=@$fileName;type=image/png" `
    "$base/api/items"
  $text = ''
  if (Test-Path $outFile) { $text = Get-Content $outFile -Raw }
  $json = $null
  try { $json = $text | ConvertFrom-Json } catch { }
  return [pscustomobject]@{ Status = [int]$code; Json = $json; Text = $text }
}

# ---------------------------------------------------------------------
# 0. Ask for the admin passcode (hidden, never saved)
# ---------------------------------------------------------------------
Write-Host 'LostLink API test' -ForegroundColor Yellow
$secure = Read-Host 'Enter the admin passcode (typing is hidden)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$script:Passcode = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

Section 'Health'
$r = Invoke-Api GET '/api/health'
Check 'Server and database are up' ($r.Status -eq 200 -and $r.Json.database -eq 'connected')
if ($r.Status -ne 200) {
  Write-Host 'The server is not reachable. Start it first: cd server, then npm run dev' -ForegroundColor Red
  exit 1
}

# ---------------------------------------------------------------------
# 1. CORS preflight (what the browser does before POST / PATCH)
# ---------------------------------------------------------------------
Section 'CORS'
try {
  $pf = Invoke-WebRequest -Uri ($base + '/api/items') -Method Options -UseBasicParsing -Headers @{
    'Origin' = 'http://localhost:5173'
    'Access-Control-Request-Method' = 'POST'
    'Access-Control-Request-Headers' = 'content-type,x-admin-passcode'
  }
  Check 'Vite origin (5173) is allowed' ($pf.Headers['Access-Control-Allow-Origin'] -eq 'http://localhost:5173')
} catch {
  Check 'Vite origin (5173) is allowed' $false $_.Exception.Message
}

# ---------------------------------------------------------------------
# 2. Item detail
# ---------------------------------------------------------------------
Section 'GET /api/items/:id'
$r = Invoke-Api GET '/api/items/2'
Check 'Item 2 returns 200' ($r.Status -eq 200 -and $r.Json.data.id -eq 2)
Check 'Public view has no reporter_email' ($r.Json.data.PSObject.Properties.Name -notcontains 'reporter_email')
Check 'Public view has status_history array' ($r.Json.data.PSObject.Properties.Name -contains 'status_history')
$r = Invoke-Api GET '/api/items/3'
Check 'Item 3 history has 1 entry, no note field (public)' (@($r.Json.data.status_history).Count -eq 1 -and $r.Json.data.status_history[0].PSObject.Properties.Name -notcontains 'note')
$r = Invoke-Api GET '/api/items/2' -Admin
Check 'Admin view includes reporter_email' ($r.Json.data.PSObject.Properties.Name -contains 'reporter_email')
$r = Invoke-Api GET '/api/items/3' -Admin
Check 'Admin view of item 3 history includes note' ($r.Json.data.status_history[0].PSObject.Properties.Name -contains 'note')
$r = Invoke-Api GET '/api/items/99999'
Check 'Missing item gives 404' ($r.Status -eq 404)
$r = Invoke-Api GET '/api/items/abc'
Check 'Bad id gives 400' ($r.Status -eq 400)

# ---------------------------------------------------------------------
# 3. Filters, search, pagination
# ---------------------------------------------------------------------
Section 'GET /api/items filters'
$r = Invoke-Api GET '/api/items?type=lost'
$wrong = @($r.Json.data | Where-Object { $_.type -ne 'lost' })
Check 'type=lost returns only lost items' ($r.Status -eq 200 -and @($r.Json.data).Count -gt 0 -and $wrong.Count -eq 0)
$r = Invoke-Api GET '/api/items?status=open'
$wrong = @($r.Json.data | Where-Object { $_.status -ne 'open' })
Check 'status=open returns only open items' ($r.Status -eq 200 -and $wrong.Count -eq 0)
$r = Invoke-Api GET '/api/items?category=2'
$wrong = @($r.Json.data | Where-Object { $_.category_id -ne 2 })
Check 'category=2 (Wallets) returns only wallets' ($r.Status -eq 200 -and @($r.Json.data).Count -ge 2 -and $wrong.Count -eq 0)
$r = Invoke-Api GET '/api/items?search=wallet'
Check 'search=wallet finds at least 2 items' ($r.Status -eq 200 -and $r.Json.pagination.total -ge 2)
$r = Invoke-Api GET '/api/items?search=zzzznomatchzzzz'
Check 'search with no match returns empty list' ($r.Status -eq 200 -and @($r.Json.data).Count -eq 0 -and $r.Json.pagination.total -eq 0)
$r = Invoke-Api GET '/api/items?limit=5&page=2'
Check 'limit=5&page=2 pagination fields' ($r.Status -eq 200 -and $r.Json.pagination.page -eq 2 -and $r.Json.pagination.limit -eq 5 -and @($r.Json.data).Count -le 5)
Check 'totalPages is correct' ($r.Json.pagination.totalPages -eq [math]::Ceiling($r.Json.pagination.total / 5))
$r = Invoke-Api GET '/api/items?date_from=2000-01-01&date_to=2100-01-01'
Check 'Wide date range returns items' ($r.Status -eq 200 -and $r.Json.pagination.total -gt 0)
$r = Invoke-Api GET '/api/items?date_from=2026-12-31&date_to=2026-01-01'
Check 'date_from later than date_to gives 400' ($r.Status -eq 400)
$r = Invoke-Api GET '/api/items?type=banana'
Check 'Invalid type gives 400 with errors[]' ($r.Status -eq 400 -and @($r.Json.errors).Count -ge 1)
$r = Invoke-Api GET '/api/items?limit=500'
Check 'limit above 50 gives 400' ($r.Status -eq 400)

# ---------------------------------------------------------------------
# 4. Create a report (JSON)
# ---------------------------------------------------------------------
Section 'POST /api/items (JSON)'
$newItem = @{
  type           = 'found'
  title          = "ZZ TEST found item $stamp"
  description    = 'Created by api-test.ps1'
  category_id    = 7
  location       = 'Test location'
  date_occurred  = $today
  reporter_name  = 'Test Reporter'
  reporter_email = 'test.reporter@example.com'
  reporter_phone = '9876500999'
}
$r = Invoke-Api POST '/api/items' -Body $newItem
Check 'Create returns 201' ($r.Status -eq 201)
Check 'New item starts as open' ($r.Json.data.status -eq 'open')
Check 'Response hides reporter_email' ($r.Json.data.PSObject.Properties.Name -notcontains 'reporter_email')
Check 'image_path is null when no image sent' ($null -eq $r.Json.data.image_path)
$testItemId = $r.Json.data.id
if ($testItemId) { $script:createdItemIds += $testItemId }

$bad = @{ type = 'banana'; title = ''; category_id = 'x'; location = ''; date_occurred = '2999-01-01'; reporter_name = ''; reporter_email = 'not-an-email' }
$r = Invoke-Api POST '/api/items' -Body $bad
Check 'Invalid report gives 400 with errors[]' ($r.Status -eq 400 -and @($r.Json.errors).Count -ge 4)
$badCat = $newItem.Clone(); $badCat['category_id'] = 9999
$r = Invoke-Api POST '/api/items' -Body $badCat
Check 'Unknown category_id gives 400' ($r.Status -eq 400)
$future = $newItem.Clone(); $future['date_occurred'] = (Get-Date).AddDays(5).ToString('yyyy-MM-dd')
$r = Invoke-Api POST '/api/items' -Body $future
Check 'Future date gives 400' ($r.Status -eq 400)

# ---------------------------------------------------------------------
# 5. Create a report with an image (multipart) + serve the image
# ---------------------------------------------------------------------
Section 'POST /api/items (image upload)'
Push-Location $env:TEMP
try {
  # 1x1 pixel PNG
  $pngBytes = [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')
  [IO.File]::WriteAllBytes((Join-Path (Get-Location) 'lostlink-test.png'), $pngBytes)
  Set-Content -Path 'lostlink-fake.png' -Value 'this is not an image'

  $r = Invoke-Upload 'lostlink-test.png' "ZZ TEST image item $stamp"
  Check 'Upload with real PNG returns 201' ($r.Status -eq 201)
  $imgPath = $r.Json.data.image_path
  Check 'image_path looks like uploads/<file>.png' ($imgPath -match '^uploads/.+\.png$')
  if ($r.Json.data.id) { $script:createdItemIds += $r.Json.data.id }

  if ($imgPath) {
    try {
      $img = Invoke-WebRequest -Uri ($base + '/' + $imgPath) -UseBasicParsing
      Check 'GET /uploads/<file> returns the image' ($img.StatusCode -eq 200 -and $img.Headers['Content-Type'] -like 'image/*')
    } catch {
      Check 'GET /uploads/<file> returns the image' $false $_.Exception.Message
    }
  }

  $r = Invoke-Upload 'lostlink-fake.png' "ZZ TEST fake image $stamp"
  Check 'Fake image (text file) is rejected with 400' ($r.Status -eq 400)
} finally {
  Remove-Item 'lostlink-test.png', 'lostlink-fake.png', 'lostlink-upload-response.json' -ErrorAction SilentlyContinue
  Pop-Location
}

# ---------------------------------------------------------------------
# 6. Admin protection
# ---------------------------------------------------------------------
Section 'Admin protection (expected 401s)'
$r = Invoke-Api GET '/api/items/2/claims'
Check 'GET claims without passcode gives 401' ($r.Status -eq 401)
$r = Invoke-Api GET '/api/items/2/claims' -Passcode 'definitely-wrong'
Check 'GET claims with wrong passcode gives 401' ($r.Status -eq 401)
$r = Invoke-Api PATCH '/api/items/2/status' -Body @{ status = 'closed' }
Check 'PATCH status without passcode gives 401' ($r.Status -eq 401)
$r = Invoke-Api PATCH '/api/claims/1' -Body @{ claim_status = 'rejected' }
Check 'PATCH claim without passcode gives 401' ($r.Status -eq 401)

Section 'GET /api/items/:id/claims (admin)'
$r = Invoke-Api GET '/api/items/2/claims' -Admin
Check 'Correct passcode gives 200' ($r.Status -eq 200) 'Is the passcode the same as ADMIN_PASSCODE in server/.env?'
Check 'Item 2 has at least 2 claims' (@($r.Json.data).Count -ge 2)
Check 'Claim includes claimant_email and proof_description' ($r.Json.data[0].PSObject.Properties.Name -contains 'claimant_email' -and $r.Json.data[0].PSObject.Properties.Name -contains 'proof_description')
$r = Invoke-Api GET '/api/items/99999/claims' -Admin
Check 'Claims for a missing item give 404' ($r.Status -eq 404)

if (-not $testItemId) {
  Write-Host 'The test item was not created, so the claim tests are skipped.' -ForegroundColor Red
  exit 1
}

# ---------------------------------------------------------------------
# 7. Claims (all on the NEW test item)
# ---------------------------------------------------------------------
Section 'POST /api/items/:id/claims'
$claimA = @{ claimant_name = 'Test Claimant A'; claimant_email = 'claimant.a@example.com'; claimant_phone = '9876500991'; proof_description = 'It has a unique sticker on the back.' }
$claimB = @{ claimant_name = 'Test Claimant B'; claimant_email = 'claimant.b@example.com'; proof_description = 'I can describe the contents in detail.' }

$r = Invoke-Api POST '/api/items/1/claims' -Body $claimA
Check 'Claim on a LOST item gives 400' ($r.Status -eq 400)
$r = Invoke-Api POST '/api/items/99999/claims' -Body $claimA
Check 'Claim on a missing item gives 404' ($r.Status -eq 404)
$r = Invoke-Api POST "/api/items/$testItemId/claims" -Body @{ claimant_name = 'X'; claimant_email = 'bad'; proof_description = 'short' }
Check 'Invalid claim gives 400 with errors[]' ($r.Status -eq 400 -and @($r.Json.errors).Count -ge 2)

$r = Invoke-Api POST "/api/items/$testItemId/claims" -Body $claimA
Check 'Valid claim A gives 201 and pending' ($r.Status -eq 201 -and $r.Json.data.claim_status -eq 'pending')
$claimAId = $r.Json.data.id
$r = Invoke-Api POST "/api/items/$testItemId/claims" -Body $claimA
Check 'Duplicate pending claim (same email) gives 409' ($r.Status -eq 409)
$r = Invoke-Api POST "/api/items/$testItemId/claims" -Body $claimB
Check 'Claim B (different email) gives 201' ($r.Status -eq 201)
$claimBId = $r.Json.data.id

$r = Invoke-Api GET "/api/items/$testItemId/claims" -Admin
Check 'Admin sees 2 pending claims on the test item' ($r.Status -eq 200 -and @($r.Json.data).Count -eq 2)

# ---------------------------------------------------------------------
# 8. Decide claims
# ---------------------------------------------------------------------
Section 'PATCH /api/claims/:id'
$r = Invoke-Api PATCH "/api/claims/$claimAId" -Admin -Body @{ claim_status = 'maybe' }
Check 'Invalid decision gives 400' ($r.Status -eq 400)
$r = Invoke-Api PATCH '/api/claims/99999' -Admin -Body @{ claim_status = 'approved' }
Check 'Missing claim gives 404' ($r.Status -eq 404)
$r = Invoke-Api PATCH "/api/claims/$claimAId" -Admin -Body @{ claim_status = 'approved'; note = 'Approved by api-test.ps1' }
Check 'Approve claim A gives 200' ($r.Status -eq 200)
Check 'Claim is approved and item is claimed' ($r.Json.data.claim_status -eq 'approved' -and $r.Json.data.item_status -eq 'claimed')
Check 'The other pending claim was auto-rejected (1)' ($r.Json.auto_rejected_claims -eq 1)
$r = Invoke-Api PATCH "/api/claims/$claimAId" -Admin -Body @{ claim_status = 'rejected' }
Check 'Deciding an already-approved claim gives 409' ($r.Status -eq 409)
$r = Invoke-Api PATCH "/api/claims/$claimBId" -Admin -Body @{ claim_status = 'approved' }
Check 'Deciding the auto-rejected claim gives 409' ($r.Status -eq 409)
$r = Invoke-Api POST "/api/items/$testItemId/claims" -Body @{ claimant_name = 'Late Claimant'; claimant_email = 'late@example.com'; proof_description = 'Trying to claim after approval.' }
Check 'New claim on a now-claimed item gives 409' ($r.Status -eq 409)

# ---------------------------------------------------------------------
# 9. Item status changes
# ---------------------------------------------------------------------
Section 'PATCH /api/items/:id/status'
$r = Invoke-Api PATCH "/api/items/$testItemId/status" -Admin -Body @{ status = 'claimed' }
Check 'Setting the same status gives 409' ($r.Status -eq 409)
$r = Invoke-Api PATCH "/api/items/$testItemId/status" -Admin -Body @{ status = 'banana' }
Check 'Invalid status gives 400' ($r.Status -eq 400)
$r = Invoke-Api PATCH '/api/items/99999/status' -Admin -Body @{ status = 'closed' }
Check 'Missing item gives 404' ($r.Status -eq 404)
$r = Invoke-Api PATCH "/api/items/$testItemId/status" -Admin -Body @{ status = 'returned'; note = 'Collected from the admin office (test).' }
Check 'claimed -> returned gives 200' ($r.Status -eq 200 -and $r.Json.data.status -eq 'returned')
Check 'Response includes reporter fields (admin)' ($r.Json.data.PSObject.Properties.Name -contains 'reporter_email')

$r = Invoke-Api GET "/api/items/$testItemId" -Admin
Check 'Admin sees 2 history rows with notes' (@($r.Json.data.status_history).Count -eq 2 -and $r.Json.data.status_history[1].note -like 'Collected*')
$r = Invoke-Api GET "/api/items/$testItemId"
Check 'Public sees 2 history rows without notes' (@($r.Json.data.status_history).Count -eq 2 -and $r.Json.data.status_history[0].PSObject.Properties.Name -notcontains 'note')

# ---------------------------------------------------------------------
# 10. Stats still work
# ---------------------------------------------------------------------
Section 'GET /api/stats'
$r = Invoke-Api GET '/api/stats'
Check 'Stats return 200 with totals' ($r.Status -eq 200 -and $r.Json.data.items.total -ge 12)
Check 'by_status adds up to total' (($r.Json.data.items.by_status.open + $r.Json.data.items.by_status.claimed + $r.Json.data.items.by_status.returned + $r.Json.data.items.by_status.closed) -eq $r.Json.data.items.total)

# ---------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------
Write-Host ''
Write-Host '===============================================' -ForegroundColor Yellow
Write-Host ("  PASSED: " + $script:pass + "    FAILED: " + $script:fail)
Write-Host ("  Test item ids created in the database: " + ($script:createdItemIds -join ', '))
Write-Host '  (Titles start with "ZZ TEST". Seed data was not changed.)'
Write-Host '===============================================' -ForegroundColor Yellow
