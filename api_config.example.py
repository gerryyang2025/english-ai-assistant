# MiniMax API Configuration
# ⚠️ IMPORTANT: This file is not tracked by git. Do not commit API keys!
#
# ============================================
# AI Service Configuration
# ============================================

# MiniMax API Key
# Get your API key from: https://platform.minimaxi.com
MINIMAX_API_KEY = 'sk-cp-your-api-key-here'

# API Endpoint (usually don't need to change)
MINIMAX_API_URL = 'https://api.minimaxi.com/v1/text/chatcompletion_v2'

# Model name
MINIMAX_MODEL = 'MiniMax-M2.1'

# ============================================
# Voice Cloning Configuration
# ============================================

# Voice Clone File ID
# Upload your reference audio file at: https://platform.minimaxi.com/user-center/files
# Get the file_id from the upload response
# Set to 0 to disable voice cloning feature
MINIMAX_VOICE_CLONE_FILE_ID = 0

# ============================================
# Rate Limiting Configuration
# ============================================

# Rate limit settings to prevent abuse
# These settings can be customized based on your needs

RATE_LIMIT = {
    # Maximum requests per hour per IP address
    # Set to 0 to disable hourly limit
    'requests_per_hour': 20,
    
    # Minimum seconds between consecutive requests
    # Set to 0 to disable cooldown
    'cooldown_seconds': 5,
    
    # Maximum requests per day per IP address (optional, 0 = unlimited)
    'requests_per_day': 0,
    
    # Maximum requests per minute per IP address (optional, 0 = unlimited)
    'requests_per_minute': 0,
}
