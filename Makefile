INFRA_COMPOSE := docker compose -f docker-compose.vps.infra.yml
APP_COMPOSE := docker compose -f docker-compose.vps.app.yml
APP_SERVICES := frontend worker navigraph

.PHONY: help compose-config infra-up infra-down infra-logs infra-ps app-build app-up app-down app-redeploy app-logs app-ps deploy

help:
	@echo "Targets:"
	@echo "  compose-config  Validate infra/app compose files"
	@echo "  infra-up        Start db/redis/questdb"
	@echo "  infra-down      Stop infra stack"
	@echo "  infra-logs      Tail infra logs"
	@echo "  infra-ps        Show infra containers"
	@echo "  app-build       Build app image locally"
	@echo "  app-up          Start app services"
	@echo "  app-down        Stop app stack"
	@echo "  app-redeploy    Recreate app services from built image"
	@echo "  app-logs        Tail app logs"
	@echo "  app-ps          Show app containers"
	@echo "  deploy          Build then redeploy app services"

compose-config:
	$(INFRA_COMPOSE) config
	$(APP_COMPOSE) config

infra-up:
	$(INFRA_COMPOSE) up -d

infra-down:
	$(INFRA_COMPOSE) down

infra-logs:
	$(INFRA_COMPOSE) logs -f --tail=200

infra-ps:
	$(INFRA_COMPOSE) ps

app-build:
	$(APP_COMPOSE) build

app-up:
	$(APP_COMPOSE) up -d

app-down:
	$(APP_COMPOSE) down

app-redeploy:
	$(APP_COMPOSE) up -d --no-deps $(APP_SERVICES)

app-logs:
	$(APP_COMPOSE) logs -f --tail=200

app-ps:
	$(APP_COMPOSE) ps

deploy: app-build app-redeploy
