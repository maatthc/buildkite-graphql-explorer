import React, { Component } from 'react'
import GraphiQL from 'graphiql'
// import { IntrospectionQuery } from 'graphql'
import { buildClientSchema, getIntrospectionQuery, parse } from 'graphql'
import type { GraphQLSchema } from 'graphql'
import GraphiQLExplorer from 'graphiql-explorer'
import { Modal, Button, InputGroup, FormControl } from 'react-bootstrap'

import { makeDefaultArg, getDefaultScalarArgValue } from './CustomArgs'

import 'bootstrap/dist/css/bootstrap.min.css'
import 'graphiql/graphiql.css'
import './App.css'

let endPoint: string
let token: string

function fetcher(params: any) {
    if (!token) return Promise.resolve('')
    return fetch(endPoint, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(params),
    })
        .then(function (response) {
            return response.text()
        })
        .then(function (responseBody) {
            try {
                return JSON.parse(responseBody)
            } catch (e) {
                return responseBody
            }
        })
}

const DEFAULT_QUERY = `# shift-option/alt-click on a query below to jump to it in the explorer
# option/alt-click on a field in the explorer to select all subfields
query MyQuery {
    organization(slug: "") {
      name
      teams(first: 10) {
        edges {
          node {
            name
          }
        }
      }
    }
  }`

type State = {
    schema?: GraphQLSchema
    query: string
    explorerIsOpen: boolean
    show: boolean
    token: string
    endPoint: string
}

class App extends Component {
    private _graphiql: GraphiQL
    state: State = {
        query: DEFAULT_QUERY,
        explorerIsOpen: true,
        show: false,
        token: '',
        endPoint: 'https://graphql.buildkite.com/v1',
    }

    constructor(props: any) {
        super(props)
        this._graphiql = new GraphiQL({ fetcher })
        this.handleShowConfig = this.handleShowConfig.bind(this)
        this.handleSave = this.handleSave.bind(this)
        this.handleExit = this.handleExit.bind(this)
    }

    handleSave(): void {
        if (this.state.token.length < 30) {
            console.log('Token seems to be incorrect!')
            return
        }
        token = this.state.token
        endPoint = this.state.endPoint
        this.setState({ show: false })
        this.updateSchema()
    }

    handleShowConfig(): void {
        this.setState({ show: true })
    }

    handleExit(): void {
        this.handleSave()
    }

    onChange(event): void {
        // Intended to run on the change of every form component
        event.preventDefault()
        this.setState({
            [event.target.name]: event.target.value,
        })
    }

    updateSchema(): void {
        if (token)
            fetcher({
                query: getIntrospectionQuery(),
            }).then((result) => {
                const editor = this._graphiql.getQueryEditor()
                editor.setOption('extraKeys', {
                    ...(editor.options.extraKeys || {}),
                    'Shift-Alt-LeftClick': this._handleInspectOperation,
                })
                if (result.data)
                    this.setState({ schema: buildClientSchema(result.data) })
            })
    }

    componentDidMount(): void {
        if (!token) this.handleShowConfig()
        else this.updateSchema()
    }

    _handleInspectOperation = (
        cm: any,
        mousePos: { line: number; ch: number }
    ) => {
        const parsedQuery = parse(this.state.query || '')

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
        this.setState({ explorerIsOpen: !this.state.explorerIsOpen })
    }

    render(): any {
        const { query, schema } = this.state
        const result = (
            <div className="graphiql-container">
                <Modal
                    show={this.state.show}
                    onHide={this.handleSave}
                    onExit={this.handleExit}
                    backdrop="static"
                    keyboard={false}
                    centered
                >
                    <Modal.Header closeButton>
                        <Modal.Title>Configuration</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <InputGroup className="mb-3">
                            <FormControl
                                name="endpoint"
                                placeholder="Enter BuildKite API Endpoint"
                                aria-label="Enter BuildKite API Endpoint"
                                aria-describedby="basic-addon2"
                                value={this.state.endPoint}
                                onChange={this.onChange.bind(this)}
                            />
                        </InputGroup>
                        <br />
                        <InputGroup className="mb-3">
                            <FormControl
                                name="token"
                                placeholder="Enter BuildKite API Access Token"
                                aria-label="Enter BuildKite API Access Token"
                                aria-describedby="basic-addon2"
                                value={this.state.token}
                                onChange={this.onChange.bind(this)}
                            />
                        </InputGroup>
                        <p className="text-muted">
                            <small>
                                Your token will be only shared with the GraphQL
                                endpoint.
                            </small>
                        </p>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="primary" onClick={this.handleSave}>
                            Continue
                        </Button>
                    </Modal.Footer>
                </Modal>
                <GraphiQLExplorer
                    schema={schema}
                    query={query}
                    onEdit={this._handleEditQuery}
                    onRunOperation={(operationName: any) =>
                        this._graphiql.handleRunQuery(operationName)
                    }
                    explorerIsOpen={this.state.explorerIsOpen}
                    onToggleExplorer={this._handleToggleExplorer}
                    getDefaultScalarArgValue={getDefaultScalarArgValue}
                    makeDefaultArg={makeDefaultArg}
                />
                <GraphiQL
                    ref={(ref) => (this._graphiql = ref!)}
                    fetcher={fetcher}
                    schema={schema}
                    query={query}
                    response="No results yet.."
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
                        <GraphiQL.Button
                            onClick={this.handleShowConfig}
                            label="Configuration"
                            title="Change Configuration"
                        />
                    </GraphiQL.Toolbar>
                </GraphiQL>
            </div>
        )
        return result
    }
}

export default App
