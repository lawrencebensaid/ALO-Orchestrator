terraform {
    required_providers {
        docker = {
            source: "kreuzwerker/docker"
        }
    }
}

provider "docker" {
    registry_auth {
        address = var.docker_registry
        username = var.docker_registry_username
        password = var.docker_registry_password
    }
}

variable "docker_registry" {
    description = "Docker registry"
    type        = string
    default     = "ghcr.io"
}

variable "docker_registry_username" {
    description = "Docker registry username"
    type        = string
    sensitive   = true
}

variable "docker_registry_password" {
    description = "Docker registry password"
    type        = string
    sensitive   = true
}

variable "docker_label" {
    description = "Docker image label "
    type        = string
}

variable "db_username" {
    description = "Database username"
    type        = string
    sensitive   = true
    default     = "root"
}

variable "db_password" {
    description = "Database password"
    type        = string
    sensitive   = true
    default     = "root"
}

variable "web_domain" {
    description = "Exposed domain to expect"
    type        = string
    default     = "localhost"
}

variable "port" {
    description = "Exposed container port"
    type        = number
    default     = 80
}

variable "secret" {
    description = "Encryption secret"
    type        = string
    sensitive   = true
    default     = "Shu$h!"
}

resource "random_string" "container_id" {
    length = 4
    special = false
    upper = false
}

resource "docker_network" "aloapi_network" {
    name = "aloapi_network"
}

resource "docker_container" "mongo_container" {
    name = join("-", ["mongo", random_string.container_id.result])
    image = docker_image.mongo_image.latest
    hostname = "db"
    ports {
        internal = 27017
        external = 27017
    }
    env = [
        "MONGO_INITDB_ROOT_USERNAME=${var.db_username}",
        "MONGO_INITDB_ROOT_PASSWORD=${var.db_password}",
        "MONGO_INITDB_DATABASE=alo-api"
    ]
    network_mode = "bridge"
    networks = [ "aloapi_network" ]
}

resource "docker_container" "aloapi_container" {
    name = join("-", ["aloapi", random_string.container_id.result])
    image = docker_image.aloapi_image.latest
    ports {
        internal = 80
        external = var.port
    }
    env = [
        "SECRET=${var.secret}",
        "WEB_PORT=80",
        "WEB_DOMAIN=localhost",
        "PROD_WEB_DOMAIN=${var.web_domain}",
        "DB_NAME=alo-api",
        "DB_HOST=db",
        "DB_USER=${var.db_username}",
        "DB_REALM=mongodb",
        "DB_PASSWORD=${var.db_password}",
    ]
    network_mode = "bridge"
    networks = [ "aloapi_network" ]
}

resource "docker_image" "mongo_image" {
    name = "mongo:5.0.2"
}

resource "docker_image" "aloapi_image" {
    name = "${var.docker_registry}/${var.docker_label}"
}