#!/bin/bash

# GitHub username, repository, and access token
USERNAME="your-username"
REPO="your-repo"
TOKEN="$GH_TOKEN"  # GH_TOKEN is an environment variable provided by GitHub Actions

# File path within the repository
FILE_PATH="data.csv"

# Content to update in the CSV file
# Replace this with the actual data you want to update
UPDATED_CONTENT="Player,Wins,Losses\nJohn Doe,3,1\nJane Smith,5,2"

# Commit message
COMMIT_MESSAGE="Update data.csv"

# API URL for updating the file
API_URL="https://api.github.com/repos/${USERNAME}/${REPO}/contents/${FILE_PATH}"

# Get the current SHA of the file
SHA=$(curl -s -H "Authorization: token ${TOKEN}" "${API_URL}" | jq -r .sha)

# Encode the updated content in Base64
ENCODED_CONTENT=$(echo -n "${UPDATED_CONTENT}" | base64)

# Construct the JSON payload for the API request
PAYLOAD=$(cat <<EOF
{
  "message": "${COMMIT_MESSAGE}",
  "content": "${ENCODED_CONTENT}",
  "sha": "${SHA}"
}
EOF
)

# Update the file using the GitHub API
curl -s -X PUT -H "Authorization: token ${TOKEN}" -d "${PAYLOAD}" "${API_URL}" > /dev/null

echo "CSV file updated successfully."
