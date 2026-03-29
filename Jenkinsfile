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
                sh '''
                    eval $(minikube docker-env)
                    docker build -t $IMAGE_NAME:$IMAGE_TAG .
                '''
            }
        }
        stage('Load image dans Minikube') {
            steps {
                echo "Image buildée directement dans Minikube, skip."
            }
        }
        stage('Deploy sur Kubernetes') {
            steps {
                sh 'kubectl apply -f k8s/deployment.yaml'
                sh 'kubectl apply -f k8s/service.yaml'
                sh 'kubectl rollout status deployment/smart-property-backend'
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