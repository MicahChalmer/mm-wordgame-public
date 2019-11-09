import * as React from "react";
import { ReactElement, useEffect, useContext } from "react";
import { usePromiseToLoad, PromiseToLoadState } from "./PromiseToLoad";
import { DataForNewGameView, Player } from "mm-wordgame-common/src/GameLogic";
import ReactLoading from "react-loading";
import prettyFormat from "pretty-format";
import Select from "react-select";
import { Formik, Field, FieldProps } from "formik";
import { AVAILABLE_RULES } from "mm-wordgame-common/src/AvailableGameRules";
import { ValueType } from "react-select/src/types";
import { fetchFromAPI, API_ENDPOINT_CONTEXT } from "./clientUtil";
import { Redirect } from "react-router-dom";

function PlayerSelect({
  form,
  field,
  availablePlayers,
}: FieldProps & { availablePlayers: Player[] }): ReactElement {
  return (
    <Select
      name={field.name}
      value={field.value}
      onBlur={field.onBlur}
      onChange={(value: ValueType<Player>) =>
        form.setFieldValue(field.name, value)
      }
      isMulti
      options={availablePlayers}
      getOptionLabel={(opt: Player) =>
        opt.name + (opt.email ? ` <${opt.email}>` : "")
      }
      getOptionValue={(opt: Player) => `${opt.name} ${opt.email}`}
      hideSelectedOptions
    />
  );
}

function NewGameForm({
  newGameData,
  userId,
}: {
  newGameData: DataForNewGameView;
  userId: string;
}): ReactElement {
  const me = newGameData.availablePlayers.find(p => p.playerId === userId);
  const initialValues = {
    wordSetName: newGameData.availableWordSetNames[0],
    players: me ? [me] : [],
    rulesName: Object.keys(AVAILABLE_RULES)[0],
  };
  const apiEndpoint = useContext(API_ENDPOINT_CONTEXT).rest;
  return (
    <Formik
      initialValues={initialValues}
      onSubmit={(values, actions) => {
        const [_abort, promise] = fetchFromAPI<{ gameId: string }>(
          apiEndpoint + "/api/newGame",
          {
            method: "POST",
            body: JSON.stringify(values),
          },
        );
        promise.then(
          ngr => actions.setStatus({ newGameId: ngr.gameId }),
          reason => {
            actions.setStatus({ err: reason });
          },
        );
      }}
      render={props => {
        return (
          <form onSubmit={props.handleSubmit}>
            <div>
              Rules:{" "}
              <Field component="select" name="rulesName">
                {Object.keys(AVAILABLE_RULES).map(r => (
                  <option value={r} key={r}>
                    {r}
                  </option>
                ))}
              </Field>
            </div>
            <div>
              Dictionary:{" "}
              <Field component="select" name="wordSetName">
                {newGameData.availableWordSetNames.map(wsn => (
                  <option value={wsn} key={wsn}>
                    {wsn}
                  </option>
                ))}
              </Field>
            </div>
            <div>
              Players:{" "}
              <Field
                component={PlayerSelect}
                name="players"
                availablePlayers={newGameData.availablePlayers}
              />
            </div>
            <button type="submit">Create Game</button>
            {props.status && props.status.err ? (
              `Error: ${props.status.err}`
            ) : props.status && props.status.newGameId ? (
              <Redirect to={`/game/${props.status.newGameId}`} />
            ) : null}
          </form>
        );
      }}
    />
  );
}

export function NewGame({ userId }: { userId: string }): ReactElement {
  const apiEndpoint = useContext(API_ENDPOINT_CONTEXT).rest;
  const [state, handle] = usePromiseToLoad<DataForNewGameView>();
  useEffect(() => {
    const [abort, promise] = fetchFromAPI<DataForNewGameView>(
      apiEndpoint + "/api/newGameData",
    );
    handle.setPromise(promise, abort.abort);
  }, [handle, userId, apiEndpoint]);
  return PromiseToLoadState.match(state, {
    WAITING() {
      return <ReactLoading type="cubes" />;
    },
    ERROR(reason) {
      return <div>Error loading new game data: {prettyFormat(reason)}</div>;
    },
    DONE(newGameData) {
      return <NewGameForm {...{ newGameData, userId }} />;
    },
  });
}
