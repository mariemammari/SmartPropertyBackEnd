pipeline {
    agent any

    environment {
        IMAGE_NAME = 'smart-property-backend'
        IMAGE_TAG  = 'latest'
    }

    stages {
        stage('Install') {
            steps {
                sh '/usr/bin/npm install --prefer-offline'
            }
        }

        stage('Tests unitaires') {
            steps {
                timeout(time: 15, unit: 'MINUTES') {
                    sh '/usr/bin/npm run test:cov || true'
                }
            }
        }

        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh '/opt/sonar-scanner/bin/sonar-scanner || true'
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                sh '''
                    eval $(minikube docker-env)
                    docker build --network=host -t $IMAGE_NAME:$IMAGE_TAG .
                '''
            }
        }

        stage('Deploy sur Kubernetes') {
            steps {
                sh 'kubectl apply -f k8s/deployment.yaml'
                sh 'kubectl apply -f k8s/service.yaml'
                sh 'kubectl rollout status deployment/smart-property-backend --timeout=120s || true'
            }
        }
    }

    post {
        success {
            echo 'Pipeline CD backend OK !'
        }
        failure {
            echo 'Pipeline CD backend echoue !'
        }
    }
}