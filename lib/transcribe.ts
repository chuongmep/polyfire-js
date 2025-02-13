import axios, { AxiosError } from "axios";
import { createClient } from "@supabase/supabase-js";
import { Readable } from "readable-stream";
import * as t from "polyfact-io-ts";
import { FileInput, fileInputToBuffer } from "./utils";
import { InputClientOptions, defaultOptions, supabaseDefaultClient } from "./clientOpts";
import { ApiError, ErrorData } from "./helpers/error";

const ResultType = t.type({
    text: t.string,
});

function randomString() {
    const a = () => Math.floor(Math.random() * 1e16).toString(36);
    return a() + a() + a();
}

export async function transcribe(
    file: FileInput,
    clientOptions: InputClientOptions = {},
    supabaseClient: { supabaseUrl: string; supabaseKey: string } = supabaseDefaultClient,
): Promise<string> {
    try {
        const { token, endpoint } = await defaultOptions(clientOptions);

        const buf = await fileInputToBuffer(file);

        const supa = createClient(supabaseClient.supabaseUrl, supabaseClient.supabaseKey, {
            auth: { persistSession: false },
        });

        const fileName = randomString();

        await supa.storage.from("audio_transcribes").upload(fileName, buf);

        const res = await axios.post(
            `${endpoint}/transcribe`,
            { file_path: fileName },
            {
                headers: {
                    "X-Access-Token": token,
                    "Content-Type": "application/json",
                },
            },
        );

        if (!ResultType.is(res.data)) {
            throw new ApiError({
                code: "mismatched_response",
                message: "The response from the API does not match the expected format",
            });
        }

        return res.data.text;
    } catch (e: unknown) {
        if (e instanceof AxiosError) {
            throw new ApiError(e?.response?.data as ErrorData);
        }
        throw e;
    }
}

export type TranscribeClient = {
    transcribe: (file: Buffer | Readable) => Promise<string>;
};

export default function client(clientOptions: InputClientOptions = {}): TranscribeClient {
    return {
        transcribe: (file: Buffer | Readable) => transcribe(file, clientOptions),
    };
}
