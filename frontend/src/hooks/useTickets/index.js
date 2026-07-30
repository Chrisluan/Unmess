import { useState, useEffect } from "react";
import toastError from "../../errors/toastError";

import api from "../../services/api";

const useTickets = ({
    searchParam,
    pageNumber,
    status,
    tab,
    date,
    showAll,
    queueIds,
    whatsappIds,
    tagIds,
    groups,
    withUnreadMessages,
}) => {
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [tickets, setTickets] = useState([]);
    const [count, setCount] = useState(0);

    useEffect(() => {
        setLoading(true);
        const delayDebounceFn = setTimeout(() => {
            const fetchTickets = async() => {
                try {
                    const { data } = await api.get("/tickets", {
                        params: {
                            searchParam,
                            pageNumber,
                            status,
                            tab,
                            date,
                            showAll,
                            queueIds,
                            whatsappIds,
                            tagIds,
                            groups,
                            withUnreadMessages,
                        },
                    })
                    setTickets(data.tickets)

                    // O encerramento automático por inatividade agora roda no
                    // backend (jobs/CloseInactiveTicketsJob). Antes dependia de
                    // alguém estar com a tela aberta e disparava um PUT por
                    // ticket a cada carregamento da lista.

                    setHasMore(data.hasMore)
                    setCount(data.count)
                    setLoading(false)
                } catch (err) {
                    setLoading(false)
                    toastError(err)
                }
            }

            fetchTickets()
        }, 500)
        return () => clearTimeout(delayDebounceFn)
    }, [
        searchParam,
        pageNumber,
        status,
        tab,
        date,
        showAll,
        queueIds,
        whatsappIds,
        tagIds,
        groups,
        withUnreadMessages,
    ])

    return { tickets, loading, hasMore, count };
};

export default useTickets;