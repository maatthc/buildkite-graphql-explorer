import React, { Component } from 'react'
import GraphiQL from 'graphiql'
import { IntrospectionQuery } from 'graphql'
import { buildClientSchema, getIntrospectionQuery, parse } from 'graphql'
import type { GraphQLSchema } from 'graphql'
import { makeDefaultArg, getDefaultScalarArgValue } from './CustomArgs'
import 'graphiql/graphiql.css'
import './App.css'
import data from './buildkite.json'
// const GraphiQLExplorer = require('graphiql-explorer')
import GraphiQLExplorer from 'graphiql-explorer'

interface Data {
    data: IntrospectionQuery
}

function fetcher(params: any): Promise<Data> {
    console.log(params)
    return Promise.resolve((data as unknown) as Data)
    // return fetch(
    //   "https://serve.onegraph.com/dynamic?app_id=c333eb5b-04b2-4709-9246-31e18db397e1",
    //   {
    //     method: "POST",
    //     headers: {
    //       Accept: "application/json",
    //       "Content-Type": "application/json"
    //     },
    //     body: JSON.stringify(params)
    //   }
    // )
    //   .then(function(response) {
    //     return response.text();
    //   })
    //   .then(function(responseBody) {
    //     try {
    //       return JSON.parse(responseBody);
    //     } catch (e) {
    //       return responseBody;
    //     }
    //   });
}

const DEFAULT_QUERY = `# shift-option/alt-click on a query below to jump to it in the explorer
# option/alt-click on a field in the explorer to select all subfields
query npmPackage {
  npm {
    package(name: "onegraph-apollo-client") {
      name
      homepage
      downloads {
        lastMonth {
          count
        }
      }
    }
  }
}

query graphQLPackage {
  npm {
    package(name: "graphql") {
      name
      homepage
      downloads {
        lastMonth {
          count
        }
      }
    }
  }
}

fragment bundlephobiaInfo on BundlephobiaDependencyInfo {
  name
  size
  version
  history {
    dependencyCount
    size
    gzip
  }
}`

type State = {
    schema?: GraphQLSchema
    query: string
    explorerIsOpen: boolean
}

class App extends Component {
    private _graphiql: GraphiQL
    graphiqlState: State = { query: DEFAULT_QUERY, explorerIsOpen: true }

    constructor(props: any) {
        super(props)
        this._graphiql = new GraphiQL({ fetcher })
    }

    componentDidMount(): void {
        fetcher({
            query: getIntrospectionQuery(),
        }).then((result) => {
            const editor = this._graphiql.getQueryEditor()
            console.log(this._graphiql)
            console.log(editor)

            editor.setOption('extraKeys', {
                ...(editor.options.extraKeys || {}),
                'Shift-Alt-LeftClick': this._handleInspectOperation,
            })

            this.setState({ schema: buildClientSchema(result.data) })
        })
    }

    _handleInspectOperation = (
        cm: any,
        mousePos: { line: number; ch: number }
    ) => {
        const parsedQuery = parse(this.graphiqlState.query || '')

        if (!parsedQuery) {
            console.error("Couldn't parse query document")
            return null
        }

        const token = cm.getTokenAt(mousePos)
        const start = { line: mousePos.line, ch: token.start }
        const end = { line: mousePos.line, ch: token.end }
        const relevantMousePos = {
            start: cm.indexFromPos(start),
            end: cm.indexFromPos(end),
        }

        const position = relevantMousePos

        const def = parsedQuery.definitions.find((definition) => {
            if (!definition.loc) {
                console.log('Missing location information for definition')
                return false
            }

            const { start, end } = definition.loc
            return start <= position.start && end >= position.end
        })

        if (!def) {
            console.error(
                'Unable to find definition corresponding to mouse position'
            )
            return null
        }

        const operationKind =
            def.kind === 'OperationDefinition'
                ? def.operation
                : def.kind === 'FragmentDefinition'
                ? 'fragment'
                : 'unknown'

        const operationName =
            def.kind === 'OperationDefinition' && !!def.name
                ? def.name.value
                : def.kind === 'FragmentDefinition' && !!def.name
                ? def.name.value
                : 'unknown'

        const selector = `.graphiql-explorer-root #${operationKind}-${operationName}`

        const el = document.querySelector(selector)
        el && el.scrollIntoView()
    }

    _handleEditQuery = (query: string | undefined): void => {
        query = query ? query : ''
        this.setState({ query })
    }

    _handleToggleExplorer = (): void => {
        this.setState({ explorerIsOpen: !this.graphiqlState.explorerIsOpen })
    }

    render(): any {
        const { query, schema } = this.graphiqlState
        console.log('Running Render')

        const result = (
            <div className="graphiql-container">
                <GraphiQLExplorer
                    schema={schema}
                    query={query}
                    onEdit={this._handleEditQuery}
                    onRunOperation={(operationName: any) =>
                        this._graphiql.handleRunQuery(operationName)
                    }
                    explorerIsOpen={this.graphiqlState.explorerIsOpen}
                    onToggleExplorer={this._handleToggleExplorer}
                    getDefaultScalarArgValue={getDefaultScalarArgValue}
                    makeDefaultArg={makeDefaultArg}
                />
                <GraphiQL
                    ref={(ref) => (this._graphiql = ref!)}
                    fetcher={fetcher}
                    schema={schema}
                    query={query}
                    onEditQuery={this._handleEditQuery}
                >
                    <GraphiQL.Toolbar>
                        <GraphiQL.Button
                            onClick={() => this._graphiql.handlePrettifyQuery()}
                            label="Prettify"
                            title="Prettify Query (Shift-Ctrl-P)"
                        />
                        <GraphiQL.Button
                            onClick={() => this._graphiql.handleToggleHistory()}
                            label="History"
                            title="Show History"
                        />
                        <GraphiQL.Button
                            onClick={this._handleToggleExplorer}
                            label="Explorer"
                            title="Toggle Explorer"
                        />
                    </GraphiQL.Toolbar>
                </GraphiQL>
            </div>
        )
        console.log(result)

        return result
    }
}

export default App
