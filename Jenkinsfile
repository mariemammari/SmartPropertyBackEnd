pipeline {
    agent any

    environment {
        IMAGE_NAME = 'smart-property-backend'
        IMAGE_TAG  = 'latest'
    }

    stages {
        stage('Install') {
            steps {
                sh '/usr/bin/npm install'
            }
        }

        stage('Tests unitaires') {
            steps {
                sh '/usr/bin/npm run test:cov'
            }
        }

        stage('Build Docker Image') {
            steps {
                sh 'docker build -t $IMAGE_NAME:$IMAGE_TAG .'
            }
        }
    }

    post {
        success {
            echo 'Pipeline CI backend OK !'
        }
        failure {
            echo 'Pipeline CI backend echoue !'
        }
    }
}