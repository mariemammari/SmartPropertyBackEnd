pipeline {
    agent any

    environment {
        NODE_OPTIONS = "--max_old_space_size=4096"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                    rm -rf node_modules
                    npm ci
                '''
            }
        }

        stage('Run Tests') {
            steps {
                sh '''
                    npm run test:cov -- --maxWorkers=2
                '''
            }
        }

        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh '''
                        /opt/sonar-scanner/bin/sonar-scanner
                    '''
                }
            }
        }

        stage('Quality Gate') {
            steps {
                timeout(time: 10, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Build') {
            steps {
                sh '''
                    npm run build
                '''
            }
        }

        stage('Docker Build') {
            steps {
                sh '''
                    docker build -t smart-property-backend:latest .
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    docker-compose up -d
                '''
            }
        }
    }

    post {
        always {
            junit 'coverage/junit.xml'
            archiveArtifacts artifacts: '**/coverage/**', allowEmptyArchive: true
        }
    }
}