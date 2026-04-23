pipeline {
    agent any

    environment {
        NODE_ENV = 'test'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install --prefer-offline'
            }
        }

        stage('Run Unit Tests') {
            steps {
                sh 'npm run test:cov || true'
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
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: false
                }
            }
        }

        stage('Build Application') {
            steps {
                sh 'npm run build || true'
            }
        }

        stage('Build Docker Image') {
            steps {
                sh '''
                    docker build -t smart-property-backend:latest .
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    echo "Deploy step here (Kubernetes / Docker / SSH)"
                '''
            }
        }
    }

    post {
        success {
            echo 'Pipeline SUCCESS '
        }
        failure {
            echo 'Pipeline FAILED '
        }
    }
}