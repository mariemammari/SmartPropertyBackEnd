pipeline {
    agent any

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