FROM langchain/langgraphjs-api:20
ADD . /deps/langgraph
ENV LANGSERVE_GRAPHS='{"router":"./app/lib/.server/langgraph/graphs/router.ts:graph","create":"./app/lib/.server/langgraph/graphs/create.ts:graph","update":"./app/lib/.server/langgraph/graphs/update.ts:graph"}'
WORKDIR /deps/langgraph
RUN pnpm i --frozen-lockfile
RUN (test ! -f /api/langgraph_api/js/build.mts && echo "Prebuild script not found, skipping") || tsx /api/langgraph_api/js/build.mts