#!/bin/bash

# Usage: ./setup_gcp_resources.sh <PROJECT_ID> <REGION>

PROJECT_ID=$1
REGION=${2:-asia-northeast1}

if [ -z "$PROJECT_ID" ]; then
  echo "Error: Project ID is required."
  echo "Usage: ./setup_gcp_resources.sh <PROJECT_ID> <REGION>"
  exit 1
fi

echo "Setting up resources for Project: $PROJECT_ID in Region: $REGION"

# 1. GCS Bucket Setup
BUCKET_NAME="${PROJECT_ID}-datalake"
echo "Creating GCS Bucket: gs://${BUCKET_NAME}..."

if ! gcloud storage buckets describe "gs://${BUCKET_NAME}" > /dev/null 2>&1; then
  gcloud storage buckets create "gs://${BUCKET_NAME}" --location="$REGION" --uniform-bucket-level-access
  echo "Bucket created."
else
  echo "Bucket already exists."
fi

# Lifecycle Policy (Example: Delete files in 'raw/' older than 180 days for specific sources if needed, 
# but simply Keeping it managed via folders as requested.)
# For now, we will just create the bucket. Detailed lifecycle rules can be applied via JSON if needed.

# 2. BigQuery Datasets Setup
DATASETS=("bronze" "silver" "gold")

for DATASET in "${DATASETS[@]}"; do
  echo "Creating BigQuery Dataset: ${DATASET}..."
  if ! bq show --dataset "${PROJECT_ID}:${DATASET}" > /dev/null 2>&1; then
    bq mk --dataset --location="$REGION" --description="Data Platform ${DATASET} layer" "${PROJECT_ID}:${DATASET}"
    echo "Dataset ${DATASET} created."
  else
    echo "Dataset ${DATASET} already exists."
  fi
done

echo "GCP Resource Setup Complete."
