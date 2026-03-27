pipeline {
    agent any

    stages {
        stage('Install') {
            steps {
                sh 'npm install'
            }
        }

        stage('Tests unitaires') {
            steps {
                sh 'npm run test:cov'
            }
        }
    }

    post {
        success {
            echo 'Tests backend OK !'
        }
        failure {
            echo 'Tests backend echoues !'
        }
    }
}